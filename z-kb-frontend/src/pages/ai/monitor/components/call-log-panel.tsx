import Icon from '@/components/icon';
import { AiEmpty } from '@/pages/ai/shared';
import {
  CALL_STATUS_LABEL,
  CALL_STATUS_TONE,
  formatDayTime,
  type CallEvent,
  type CallStatus,
} from '@/pages/ai/monitor/mock';

type StatusFilter = 'all' | CallStatus;

interface CallLogPanelProps {
  events: CallEvent[];
  totalEvents: number;
  counts: Record<StatusFilter, number>;
  keyword: string;
  onKeyword: (value: string) => void;
  status: StatusFilter;
  onStatus: (value: StatusFilter) => void;
  toolCode: string;
  onClearTool: () => void;
  visible: number;
  onLoadMore: () => void;
  onOpen: (event: CallEvent) => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'timeout', label: '超时' },
];

export default function CallLogPanel({
  events,
  totalEvents,
  counts,
  keyword,
  onKeyword,
  status,
  onStatus,
  toolCode,
  onClearTool,
  visible,
  onLoadMore,
  onOpen,
}: CallLogPanelProps) {
  const shown = events.slice(0, visible);
  const filtering = !!keyword.trim() || status !== 'all' || !!toolCode;

  return (
    <section className="panel ai-monitor-log">
      <div className="panel-head">
        <h3>
          <Icon name="list" size={14} />
          调用明细
          <span className="hint">
            {events.length} / {totalEvents}
          </span>
        </h3>
      </div>

      <div className="table-toolbar">
        <div className="left">
          <div className="input-icon">
            <Icon name="search" size={13} />
            <input
              className="input"
              style={{ width: 230 }}
              placeholder="搜索工具、智能体或调用 ID"
              value={keyword}
              onChange={(event) => onKeyword(event.target.value)}
            />
          </div>
          <div className="segmented sm">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={status === option.value ? 'active' : ''}
                onClick={() => onStatus(option.value)}
              >
                {option.label}
                <span className="tnum">{counts[option.value]}</span>
              </button>
            ))}
          </div>
          {toolCode ? (
            <button
              className="filter-chip active"
              type="button"
              title="清除工具筛选"
              onClick={onClearTool}
            >
              工具：{toolCode}
              <span className="x">×</span>
            </button>
          ) : null}
        </div>
        <div className="right">
          <span className="note">共 {events.length} 条命中</span>
        </div>
      </div>

      {!events.length ? (
        <AiEmpty
          icon={filtering ? 'search' : 'inbox'}
          title={filtering ? '没有匹配的调用' : '该时间范围内没有调用'}
          action={
            filtering ? (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  onKeyword('');
                  onStatus('all');
                  onClearTool();
                }}
              >
                清空筛选
              </button>
            ) : null
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>工具</th>
                <th>智能体</th>
                <th>耗时</th>
                <th>状态</th>
                <th>调用 ID</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((event) => (
                <tr key={event.id}>
                  <td className="mono-sm">{formatDayTime(event.at)}</td>
                  <td>
                    <div className="ai-name-cell">
                      <b>{event.toolName}</b>
                      <small>{event.toolCode}</small>
                    </div>
                  </td>
                  <td>
                    <div className="ai-name-cell">
                      <b>{event.agentName}</b>
                      <small>{event.agentCode}</small>
                    </div>
                  </td>
                  <td
                    className={`mono-sm ${event.durationMs >= 2000 ? 'slow' : ''}`}
                  >
                    {event.durationMs.toLocaleString()} ms
                  </td>
                  <td>
                    <span
                      className={`tag ${CALL_STATUS_TONE[event.status]} sm`}
                    >
                      {CALL_STATUS_LABEL[event.status]}
                    </span>
                  </td>
                  <td className="mono-sm">{event.id}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn xs ghost"
                        type="button"
                        onClick={() => onOpen(event)}
                      >
                        <Icon name="eye" size={11} />
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events.length ? (
        <div className="panel-foot">
          <span>
            显示 {shown.length} / {events.length} 条
          </span>
          {shown.length < events.length ? (
            <button className="btn xs" type="button" onClick={onLoadMore}>
              加载更多
            </button>
          ) : (
            <span className="note">已到末尾</span>
          )}
        </div>
      ) : null}
    </section>
  );
}
