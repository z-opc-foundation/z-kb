import { createPortal } from 'react-dom';
import Icon from '@/components/icon';
import { useEscapeKey } from '@/hooks/use-escape-key';
import {
  CALL_STATUS_LABEL,
  CALL_STATUS_TONE,
  formatDayTime,
  type CallEvent,
} from '@/pages/ai/monitor/mock';

export default function CallDetailDrawer({
  event,
  onClose,
}: {
  event: CallEvent;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  return createPortal(
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <div
        className="drawer ai-call-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name="scan" size={18} />
            </div>
            <div className="d-copy">
              <h2>
                调用详情
                <span className={`tag ${CALL_STATUS_TONE[event.status]}`}>
                  {CALL_STATUS_LABEL[event.status]}
                </span>
              </h2>
              <div className="d-sub">
                <span className="mono">{event.id}</span>
              </div>
            </div>
            <div className="d-actions">
              <button
                className="close-btn"
                type="button"
                aria-label="关闭"
                onClick={onClose}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="drawer-body">
          <div className="ai-run-meta">
            <div>
              <small>工具</small>
              <b title={event.toolCode}>{event.toolName}</b>
            </div>
            <div>
              <small>智能体</small>
              <b title={event.agentCode}>{event.agentName}</b>
            </div>
            <div>
              <small>耗时</small>
              <b>{event.durationMs.toLocaleString()} ms</b>
            </div>
            <div>
              <small>发生时间</small>
              <b>{formatDayTime(event.at)}</b>
            </div>
          </div>

          {event.errorMessage ? (
            <div className="callout danger mt-16">
              <Icon name="alert-triangle" size={14} />
              <div className="ct">
                <b>{event.status === 'timeout' ? '调用超时' : '调用失败'}</b>
                <p>{event.errorMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="divider" />

          <div className="ai-usage-block">
            <h4>调用入参</h4>
            <pre className="ai-json">{JSON.stringify(event.args, null, 2)}</pre>
          </div>

          <div className="ai-usage-block">
            <h4>返回摘要</h4>
            <p className="note">{event.resultSummary}</p>
          </div>
        </div>

        <div className="drawer-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
