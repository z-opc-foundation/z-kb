import Icon from '@/components/icon';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { getAuditLog, type AuditLogRecord } from '@/services/audit';
import { formatDateTime } from '@/utils/format';
import { useEffect, useState } from 'react';

function prettyJson(value?: string | null): string {
  if (!value) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditDetailDrawer({
  record,
  actorName,
  onClose,
}: {
  record: AuditLogRecord;
  /** 列表已把 staffId 换成人名时一并传进来；取不到就只显示 ID */
  actorName?: string;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const [detail, setDetail] = useState<AuditLogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // 列表不带出入参大字段，打开抽屉时再按主键取完整报文
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadFailed(false);
    void getAuditLog(record.id)
      .then((response) => {
        if (!alive) {
          return;
        }
        if (response) {
          setDetail(response);
        } else {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [record.id]);

  const data = detail ?? record;
  const failed = data.success === 0;
  const requestJson = prettyJson(data.requestParams);
  const responseJson = prettyJson(data.responseResult);
  const kbLog = data.type === 'KB';

  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <div
        className="drawer audit-detail-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name="shield-check" size={18} />
            </div>
            <div className="d-copy">
              <h2>
                操作详情
                <span className={`tag ${failed ? 'red' : 'green'}`}>
                  {failed ? '失败' : '成功'}
                </span>
              </h2>
              <div className="d-sub">
                <span className="mono">{data.action}</span>
              </div>
            </div>
            <div className="d-actions">
              <button className="close-btn" type="button" aria-label="关闭" onClick={onClose}>
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="drawer-body">
          <div className="audit-meta">
            <div>
              <small>动作</small>
              <b>{data.actionDesc || data.action}</b>
              <span className="mono">{data.action}</span>
            </div>
            <div>
              <small>操作人</small>
              <b>{actorName ?? data.actorId ?? '未识别'}</b>
              <span className="mono">
                {actorName && data.actorId ? `actorId ${data.actorId} · ` : ''}
                {data.tenantCode}
              </span>
            </div>
            <div>
              <small>发生时间</small>
              <b>{formatDateTime(data.createTime, 'YYYY-MM-DD HH:mm:ss')}</b>
              <span className="mono">耗时 {data.durationMs ?? '—'} ms</span>
            </div>
            <div>
              <small>请求</small>
              <b>
                {data.httpMethod || '—'} <span className="mono">{data.requestUri || '—'}</span>
              </b>
              <span className="mono">{data.clientIp || '—'}</span>
            </div>
            <div>
              <small>归属</small>
              <b>{kbLog ? '知识库级' : '系统级'}</b>
              <span className="mono">{kbLog ? data.bizRef || '未记录知识库' : '不归属业务对象'}</span>
            </div>
            <div>
              <small>被代理方法</small>
              <b className="mono">{data.targetMethod}</b>
              <span className="mono">{data.traceId ? `traceId ${data.traceId}` : '无 traceId'}</span>
            </div>
            <div className="span-2">
              <small>被代理类</small>
              <b className="mono">{data.targetClass || '—'}</b>
            </div>
            {data.userAgent ? (
              <div className="span-2">
                <small>User-Agent</small>
                <b className="mono audit-ua">{data.userAgent}</b>
              </div>
            ) : null}
          </div>

          {failed ? (
            <div className="callout danger mt-16">
              <Icon name="alert-triangle" size={14} />
              <div className="ct">
                <b>业务异常</b>
                <p>{data.errorMessage || '未记录异常摘要'}</p>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="audit-payload-loading" role="status">
              <span className="spinner" />
              正在读取完整出入参…
            </div>
          ) : loadFailed ? (
            <div className="callout danger mt-16">
              <Icon name="alert-triangle" size={14} />
              <div className="ct">
                <b>完整出入参读取失败</b>
                <p>摘要信息仍然可用；关闭抽屉后重新打开可重试。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="audit-payload mt-20">
                <div className="audit-payload-head">
                  <b>入参</b>
                  <span>已脱敏并按长度截断</span>
                </div>
                <pre>{requestJson || '该调用未记录入参'}</pre>
              </div>
              <div className="audit-payload mt-16">
                <div className="audit-payload-head">
                  <b>返回值</b>
                  <span>已脱敏并按长度截断</span>
                </div>
                <pre>{responseJson || (failed ? '调用失败，无返回值' : '该调用未记录返回值')}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
