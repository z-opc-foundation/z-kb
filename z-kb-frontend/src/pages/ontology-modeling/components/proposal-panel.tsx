import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { fmtAiTime } from '@/pages/ai/shared';
import { useEffect, useRef, useState } from 'react';
import {
  getProposalDetail,
  pageProposals,
  proposalStatusLabel,
  proposalTypeLabel,
  rejectProposal,
  submitProposal,
  type ProposalFreezeResult,
  type ProposalRecord,
} from '@/services/ontology-modeling';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: '1', label: '待提交' },
  { value: '2', label: '已提交' },
  { value: '3', label: '已驳回' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: '1', label: '结构' },
  { value: '2', label: '数据' },
];

function statusTagClass(status: number): string {
  if (status === 2) {
    return 'green';
  }
  if (status === 3) {
    return 'red';
  }
  return 'amber';
}

export function ProposalPanel({ refreshTick }: { refreshTick: number }) {
  const [records, setRecords] = useState<ProposalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [proposalType, setProposalType] = useState('');
  const [detail, setDetail] = useState<ProposalRecord | null>(null);
  const [rejecting, setRejecting] = useState<ProposalRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [freezeResult, setFreezeResult] = useState<ProposalFreezeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const size = 10;
  const loadSeqRef = useRef(0);

  const load = async (page: number) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const result = await pageProposals({
      current: page,
      size,
      status: status ? Number(status) : undefined,
      proposalType: proposalType ? Number(proposalType) : undefined,
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
    // 筛选与 refreshTick（对话产生新提案）变化时回到第一页重拉
  }, [status, proposalType, refreshTick]);

  const openDetail = async (code: string) => {
    const result = await getProposalDetail(code);
    setDetail(result || null);
  };

  const confirmReject = async () => {
    if (!rejecting) {
      return;
    }
    const reason = rejectReason.trim();
    if (!reason) {
      return;
    }
    setBusy(true);
    const done = await rejectProposal(rejecting.code, reason);
    setBusy(false);
    if (done !== undefined) {
      setRejecting(null);
      setRejectReason('');
      void load(current);
    }
  };

  const confirmSubmit = async (code: string) => {
    setBusy(true);
    const result = await submitProposal(code);
    setBusy(false);
    if (result) {
      setFreezeResult(result);
      setDetail(null);
      void load(current);
    }
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
        <select
          className="select"
          value={proposalType}
          onChange={(event) => setProposalType(event.target.value)}
        >
          {TYPE_OPTIONS.map((option) => (
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
          待提交提案经「冻结提交」校验编译为工单；审批人在工单管理中处理
        </span>
      </div>
      <div className="om-table">
        <div className="om-table-row om-table-head">
          <span>提案编码 / 标题</span>
          <span>类型</span>
          <span>行数</span>
          <span>状态</span>
          <span>关联工单</span>
          <span>创建时间</span>
          <span>操作</span>
        </div>
        {loading ? <div className="om-table-empty">正在加载提案…</div> : null}
        {!loading && !records.length ? (
          <div className="om-table-empty">暂无提案：在对话建模中让建模师产出提案</div>
        ) : null}
        {records.map((record) => (
          <div key={record.code} className="om-table-row">
            <span className="om-cell-main">
              <b>{record.title}</b>
              <small className="mono">{record.code}</small>
            </span>
            <span>
              <span className={`tag sm ${record.proposalType === 1 ? 'blue' : 'violet'}`}>
                {proposalTypeLabel(record.proposalType)}
              </span>
            </span>
            <span className="mono">{record.rowCount ?? '-'}</span>
            <span>
              <span className={`tag sm ${statusTagClass(record.status)}`}>
                {proposalStatusLabel(record.status)}
              </span>
            </span>
            <span className="mono om-cell-wrap">{record.orderCode || '—'}</span>
            <span>{fmtAiTime(record.createTime)}</span>
            <span className="om-cell-actions">
              <button
                className="btn xs ghost"
                type="button"
                onClick={() => void openDetail(record.code)}
              >
                详情
              </button>
              {record.status === 1 ? (
                <>
                  <button
                    className="btn xs primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmSubmit(record.code)}
                  >
                    冻结提交
                  </button>
                  <button
                    className="btn xs ghost"
                    type="button"
                    onClick={() => {
                      setRejecting(record);
                      setRejectReason('');
                    }}
                  >
                    驳回
                  </button>
                </>
              ) : null}
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
        <AppModal
          icon="file-text"
          title={detail.title}
          sub={`提案 ${detail.code}`}
          width={640}
          onClose={() => setDetail(null)}
          body={
            <div className="om-detail">
              <div className="om-detail-grid">
                <div>
                  <span>类型</span>
                  <b>{proposalTypeLabel(detail.proposalType)}</b>
                </div>
                <div>
                  <span>状态</span>
                  <b>{proposalStatusLabel(detail.status)}</b>
                </div>
                <div>
                  <span>行数</span>
                  <b className="mono">{detail.rowCount ?? '-'}</b>
                </div>
                <div>
                  <span>关联工单</span>
                  <b className="mono">{detail.orderCode || '—'}</b>
                </div>
                <div>
                  <span>来源</span>
                  <b>{detail.sourceType === 'DIALOG' ? '对话' : detail.sourceType || '—'}</b>
                </div>
                <div>
                  <span>创建时间</span>
                  <b>{fmtAiTime(detail.createTime)}</b>
                </div>
              </div>
              {detail.rejectReason ? (
                <div className="callout danger">
                  <Icon name="alert-triangle" size={15} />
                  <div className="ct">
                    <b>驳回理由</b>
                    <p>{detail.rejectReason}</p>
                  </div>
                </div>
              ) : null}
              {detail.summaryJson ? (
                <details className="om-json-details">
                  <summary>变更摘要 JSON</summary>
                  <pre className="om-tool-json">{detail.summaryJson}</pre>
                </details>
              ) : null}
              {detail.storageFile ? (
                <div className="om-detail-file mono">{detail.storageFile}</div>
              ) : null}
            </div>
          }
          footLeft="提案内容不可变，冻结提交后进入编译与审批链路"
          footRight={
            detail.status === 1 ? (
              <>
                <button className="btn" type="button" onClick={() => setDetail(null)}>
                  关闭
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setRejecting(detail);
                    setDetail(null);
                    setRejectReason('');
                  }}
                >
                  驳回
                </button>
                <button
                  className="btn primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmSubmit(detail.code)}
                >
                  冻结提交
                </button>
              </>
            ) : (
              <button className="btn" type="button" onClick={() => setDetail(null)}>
                关闭
              </button>
            )
          }
        />
      ) : null}

      {rejecting ? (
        <AppModal
          icon="x-circle"
          title="驳回提案"
          sub={rejecting.title}
          width={520}
          onClose={() => setRejecting(null)}
          body={
            <div className="field">
              <label>驳回理由（必填）</label>
              <textarea
                className="input"
                rows={3}
                value={rejectReason}
                placeholder="说明驳回原因，会回传给建模对话链路"
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setRejecting(null)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!rejectReason.trim() || busy}
                onClick={() => void confirmReject()}
              >
                确认驳回
              </button>
            </>
          }
        />
      ) : null}

      {freezeResult ? (
        <AppModal
          icon="check-circle"
          title="提案已冻结提交"
          sub={freezeResult.proposalCode}
          width={560}
          onClose={() => setFreezeResult(null)}
          body={
            <div className="om-detail">
              {freezeResult.restrictedReasons?.length ? (
                <div className="callout warning">
                  <Icon name="alert-triangle" size={15} />
                  <div className="ct">
                    <b>存在阻断项</b>
                    {freezeResult.restrictedReasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="callout">
                  <Icon name="info" size={15} />
                  <div className="ct">
                    <b>已编译为工单</b>
                    <p>
                      工单编码 <code className="mono">{freezeResult.orderCode}</code>
                      ，共 {freezeResult.itemCount} 个变更项，请在工单管理中审批。
                    </p>
                  </div>
                </div>
              )}
            </div>
          }
          footRight={
            <button className="btn primary" type="button" onClick={() => setFreezeResult(null)}>
              知道了
            </button>
          }
        />
      ) : null}
    </section>
  );
}
