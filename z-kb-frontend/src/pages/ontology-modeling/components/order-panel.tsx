import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { fmtAiTime } from '@/pages/ai/shared';
import { useEffect, useRef, useState } from 'react';
import {
  approveOrder,
  getOrderDetail,
  getOrderTaskProgress,
  orderStatusLabel,
  pageOrders,
  rejectOrder,
  retryOrderItem,
  type ChangeOrderRecord,
  type OrderDetail,
  type OrderTaskProgress,
} from '@/services/ontology-modeling';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: '1', label: '待审批' },
  { value: '2', label: '已驳回' },
  { value: '3', label: '已审批' },
  { value: '4', label: '执行中' },
  { value: '5', label: '已生效' },
  { value: '6', label: '生效有失败' },
  { value: '7', label: '执行失败' },
];

function statusTagClass(status: number): string {
  if (status === 5) {
    return 'green';
  }
  if (status === 2 || status === 7) {
    return 'red';
  }
  if (status === 6) {
    return 'amber';
  }
  return 'blue';
}

/** 审批通过即自动下发执行；这些状态下轮询执行进度。 */
const RUNNING_STATUS = new Set([3, 4]);

/** 任务内核的终态：到达后停止轮询。 */
const TERMINAL_RUN_STATUS = new Set(['COMPLETED', 'FAILED', 'CANCELED']);

function runStatusTagClass(status?: string): string {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'FAILED' || status === 'CANCELED') {
    return 'red';
  }
  return 'blue';
}

function prettyJson(value?: string): string {
  if (!value) {
    return '—';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function OrderDetailModal({
  detail,
  onChanged,
  onRefreshDetail,
  onClose,
}: {
  detail: OrderDetail;
  onChanged: () => void;
  onRefreshDetail: () => void;
  onClose: () => void;
}) {
  const order = detail.order;
  const [progress, setProgress] = useState<OrderTaskProgress | undefined>();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryItem, setRetryItem] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const running = RUNNING_STATUS.has(order.status);

  useEffect(() => {
    if (!running) {
      setProgress(undefined);
      return;
    }
    let alive = true;
    const poll = async () => {
      const result = await getOrderTaskProgress(order.code);
      if (!alive) {
        return;
      }
      setProgress(result);
      if (result && TERMINAL_RUN_STATUS.has(result.runStatus || '') && timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    void poll();
    timerRef.current = window.setInterval(() => void poll(), 3000);
    return () => {
      alive = false;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [order.code, running]);

  const confirmApprove = async () => {
    setBusy(true);
    const done = await approveOrder(order.code);
    setBusy(false);
    if (done !== undefined) {
      onChanged();
      onClose();
    }
  };

  const confirmReject = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    const done = await rejectOrder(order.code, trimmed);
    setBusy(false);
    if (done !== undefined) {
      setRejectOpen(false);
      onChanged();
      onClose();
    }
  };

  const confirmRetry = async (itemCode: string) => {
    setBusy(true);
    const done = await retryOrderItem(itemCode);
    setBusy(false);
    setRetryItem(null);
    if (done !== undefined) {
      onChanged();
      onRefreshDetail();
    }
  };

  return (
    <>
    <AppModal
      icon="layers"
      title={order.title || order.orderNo || order.code}
      sub={`工单 ${order.code}`}
      width={760}
      onClose={onClose}
      body={
        <div className="om-detail">
          <div className="om-detail-grid">
            <div>
              <span>状态</span>
              <b>
                <span className={`tag sm ${statusTagClass(order.status)}`}>
                  {orderStatusLabel(order.status)}
                </span>
              </b>
            </div>
            <div>
              <span>类型</span>
              <b>{order.orderType === 1 ? '结构' : '数据'}</b>
            </div>
            <div>
              <span>变更项</span>
              <b className="mono">
                {order.itemCount ?? detail.items.length}
                {order.failedItemCount ? `（失败 ${order.failedItemCount}）` : ''}
              </b>
            </div>
            <div>
              <span>Schema 版本</span>
              <b className="mono">
                {order.schemaVersionBefore ?? '—'} → {order.schemaVersionAfter ?? '—'}
              </b>
            </div>
            <div>
              <span>创建时间</span>
              <b>{fmtAiTime(order.createTime)}</b>
            </div>
            <div>
              <span>生效时间</span>
              <b>{fmtAiTime(order.effectiveTime)}</b>
            </div>
          </div>
          {order.rejectReason ? (
            <div className="callout danger">
              <Icon name="alert-triangle" size={15} />
              <div className="ct">
                <b>驳回理由</b>
                <p>{order.rejectReason}</p>
              </div>
            </div>
          ) : null}

          {progress ? (
            <div className="om-progress">
              <div className="om-progress-head">
                <b>执行进度</b>
                <span className={`tag sm ${runStatusTagClass(progress.runStatus)}`}>
                  {progress.runStatus || '—'}
                </span>
                <span className="mono">
                  成功 {progress.successCount ?? 0} / 失败 {progress.failedCount ?? 0} / 共{' '}
                  {progress.totalCount ?? 0}
                </span>
                {progress.failureSummary ? (
                  <span className="om-progress-fail">{progress.failureSummary}</span>
                ) : null}
              </div>
              {progress.nodes?.length ? (
                <div className="om-progress-nodes">
                  {progress.nodes.map((node) => (
                    <div key={node.nodeCode} className="om-progress-node">
                      <span className="mono">{node.nodeCode}</span>
                      <span>{node.nodeRole || '—'}</span>
                      <span className={`tag sm ${runStatusTagClass(node.runStatus)}`}>
                        {node.runStatus || '—'}
                      </span>
                      <span className="mono">
                        {node.attempts ?? 0}/{node.maxAttempts ?? 0}
                      </span>
                      {node.failureSummary ? (
                        <span className="om-progress-fail">{node.failureSummary}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="om-items">
            <div className="om-items-title">变更项（{detail.items.length}）</div>
            {detail.items.map((item) => (
              <details key={item.code} className="om-item">
                <summary>
                  <span className="mono">#{item.seqNo ?? '-'}</span>
                  <span className={`tag sm ${item.itemType === 'TAG' ? 'blue' : 'violet'}`}>
                    {item.itemType || '—'}
                  </span>
                  <b>{item.targetName || item.targetType || item.code}</b>
                  {item.errorMsg ? <span className="om-progress-fail">{item.errorMsg}</span> : null}
                </summary>
                <div className="om-item-body">
                  <div className="om-json-cols">
                    <div>
                      <span>变更前</span>
                      <pre className="om-tool-json">{prettyJson(item.beforeJson)}</pre>
                    </div>
                    <div>
                      <span>变更后</span>
                      <pre className="om-tool-json">{prettyJson(item.afterJson)}</pre>
                    </div>
                  </div>
                  {item.errorMsg ? (
                    <div className="om-progress-fail">失败原因：{item.errorMsg}</div>
                  ) : null}
                  {order.status === 6 && item.errorMsg ? (
                    <button
                      className="btn xs"
                      type="button"
                      disabled={busy}
                      onClick={() => setRetryItem(item.code)}
                    >
                      重试此项
                    </button>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      }
      footLeft="审批通过即自动下发执行任务；生效后 Schema 与实例可在本体概览检索"
      footRight={
        order.status === 1 ? (
          <>
            <button className="btn" type="button" onClick={() => setRejectOpen(true)}>
              驳回
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => void confirmApprove()}
            >
              审批通过
            </button>
          </>
        ) : (
          <button className="btn" type="button" onClick={onClose}>
            关闭
          </button>
        )
      }
    />
    {rejectOpen ? (
      <AppModal
        icon="x-circle"
        title="驳回工单"
        sub="驳回工单会同步驳回来源提案"
        width={520}
        onClose={() => setRejectOpen(false)}
        body={
          <div className="field">
            <label>驳回理由（必填）</label>
            <textarea
              className="input"
              rows={3}
              value={reason}
              placeholder="说明驳回原因"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        }
        footRight={
          <>
            <button className="btn" type="button" onClick={() => setRejectOpen(false)}>
              取消
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={!reason.trim() || busy}
              onClick={() => void confirmReject()}
            >
              确认驳回
            </button>
          </>
        }
      />
    ) : null}

    {retryItem ? (
      <AppModal
        icon="refresh"
        title="重试失败项"
        sub={`变更项 ${retryItem}，不重新审批`}
        width={480}
        onClose={() => setRetryItem(null)}
        body={
          <div className="callout">
            <Icon name="info" size={15} />
            <div className="ct">
              <b>单项幂等重试</b>
              <p>只重跑该失败项，已成功项不受影响。</p>
            </div>
          </div>
        }
        footRight={
          <>
            <button className="btn" type="button" onClick={() => setRetryItem(null)}>
              取消
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => void confirmRetry(retryItem)}
            >
              重试
            </button>
          </>
        }
      />
    ) : null}
    </>
  );
}

export function OrderPanel({ refreshTick }: { refreshTick: number }) {
  const [records, setRecords] = useState<ChangeOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const size = 10;
  const loadSeqRef = useRef(0);

  const load = async (page: number) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const result = await pageOrders({
      current: page,
      size,
      status: status ? Number(status) : undefined,
    });
    // 过期响应丢弃：筛选快速切换时旧请求可能后到
    if (seq !== loadSeqRef.current) {
      return;
    }
    setRecords(result?.records || []);
    setTotal(result?.total || 0);
    setCurrent(page);
    setLoading(false);
  };

  useEffect(() => {
    void load(1);
  }, [status, refreshTick]);

  const openDetail = async (code: string) => {
    const result = await getOrderDetail(code);
    setDetail(result || null);
  };

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <section className="panel om-panel">
      <div className="om-toolbar">
        <select
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="btn ghost" type="button" onClick={() => void load(current)}>
          <Icon name="refresh" size={13} />
          刷新
        </button>
        <span className="om-toolbar-note">
          工单审批通过即自动执行；执行结果回写 Schema 与图库
        </span>
      </div>
      <div className="om-table">
        <div className="om-table-row om-table-head">
          <span>工单编码 / 标题</span>
          <span>类型</span>
          <span>变更项</span>
          <span>状态</span>
          <span>创建时间</span>
          <span>操作</span>
        </div>
        {loading ? <div className="om-table-empty">正在加载工单…</div> : null}
        {!loading && !records.length ? (
          <div className="om-table-empty">暂无工单：待提交提案冻结后自动生成</div>
        ) : null}
        {records.map((record) => (
          <div key={record.code} className="om-table-row">
            <span className="om-cell-main">
              <b>{record.title || record.orderNo || record.code}</b>
              <small className="mono">{record.code}</small>
            </span>
            <span>
              <span className={`tag sm ${record.orderType === 1 ? 'blue' : 'violet'}`}>
                {record.orderType === 1 ? '结构' : '数据'}
              </span>
            </span>
            <span className="mono">
              {record.itemCount ?? '-'}
              {record.failedItemCount ? `（失败 ${record.failedItemCount}）` : ''}
            </span>
            <span>
              <span className={`tag sm ${statusTagClass(record.status)}`}>
                {orderStatusLabel(record.status)}
              </span>
            </span>
            <span>{fmtAiTime(record.createTime)}</span>
            <span className="om-cell-actions">
              <button
                className="btn xs ghost"
                type="button"
                onClick={() => void openDetail(record.code)}
              >
                详情
              </button>
            </span>
          </div>
        ))}
      </div>
      {pages > 1 ? (
        <div className="om-pager">
          <button
            className="btn xs ghost"
            type="button"
            disabled={current <= 1}
            onClick={() => void load(current - 1)}
          >
            上一页
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="btn xs ghost"
            type="button"
            disabled={current >= pages}
            onClick={() => void load(current + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}

      {detail ? (
        <OrderDetailModal
          detail={detail}
          onChanged={() => void load(current)}
          onRefreshDetail={() => void openDetail(detail.order.code)}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </section>
  );
}
