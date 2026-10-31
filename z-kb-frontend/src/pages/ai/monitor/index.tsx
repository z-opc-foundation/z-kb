import Icon from '@/components/icon';
import CallDetailDrawer from '@/pages/ai/monitor/components/call-detail-drawer';
import CallLogPanel from '@/pages/ai/monitor/components/call-log-panel';
import FailureReasons from '@/pages/ai/monitor/components/failure-reasons';
import StatCards from '@/pages/ai/monitor/components/stat-cards';
import ToolRanking from '@/pages/ai/monitor/components/tool-ranking';
import TrendChart from '@/pages/ai/monitor/components/trend-chart';
import { useCallMonitor } from '@/pages/ai/monitor/hooks/use-call-monitor';
import {
  MONITOR_RANGE_OPTIONS,
  type CallEvent,
  type CallStatus,
  type MonitorRange,
} from '@/pages/ai/monitor/mock';
import { AiLoading } from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import '@/pages/ai/monitor/monitor.less';
import { useEffect, useMemo, useState } from 'react';

type StatusFilter = 'all' | CallStatus;

const PAGE_SIZE = 30;

export default function CallMonitorPage() {
  const [range, setRange] = useState<MonitorRange>('24h');
  const { loading, snapshot, previous, refresh } = useCallMonitor(range);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [toolCode, setToolCode] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<CallEvent | null>(null);

  const events = useMemo(() => snapshot?.events ?? [], [snapshot]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [range, keyword, status, toolCode]);

  const scoped = useMemo(
    () => (toolCode ? events.filter((item) => item.toolCode === toolCode) : events),
    [events, toolCode],
  );

  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const result: Record<StatusFilter, number> = {
      all: scoped.length,
      success: 0,
      failed: 0,
      timeout: 0,
    };
    scoped.forEach((item) => {
      result[item.status] += 1;
    });
    return result;
  }, [scoped]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return scoped.filter((item) => {
      if (status !== 'all' && item.status !== status) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${item.id} ${item.toolCode} ${item.toolName} ${item.agentCode} ${item.agentName}`
        .toLowerCase()
        .includes(query);
    });
  }, [keyword, scoped, status]);

  const rangeLabel =
    MONITOR_RANGE_OPTIONS.find((option) => option.value === range)?.label ||
    '最近 24 小时';

  return (
    <div className="view ai-monitor">
      <div className="view-bar">
        <span className="tag amber">演示数据</span>
        <span className="spacer" />
        <div className="segmented">
          {MONITOR_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={range === option.value ? 'active' : ''}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="btn ghost" type="button" onClick={refresh}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" size={14} />}
          刷新
        </button>
      </div>

      {loading && !snapshot ? (
        <section className="panel">
          <AiLoading text="正在汇总调用记录…" />
        </section>
      ) : snapshot ? (
        <>
          <StatCards snapshot={snapshot} previous={previous} />

          <section className="panel ai-monitor-trend-panel">
            <div className="panel-head">
              <h3>
                <Icon name="activity" size={14} />
                调用趋势
                <span className="hint">{rangeLabel}</span>
              </h3>
              <div className="actions">
                <span className="note">
                  共 {snapshot.stats.total.toLocaleString()} 次 · 失败{' '}
                  {snapshot.stats.failed.toLocaleString()} 次
                </span>
              </div>
            </div>
            <div className="panel-body tight">
              <TrendChart points={snapshot.trend} />
            </div>
          </section>

          <div className="ai-monitor-charts">
            <ToolRanking
              toolStats={snapshot.toolStats}
              selectedTool={toolCode}
              onSelect={setToolCode}
            />
            <FailureReasons
              failureStats={snapshot.failureStats}
              failed={snapshot.stats.failed}
            />
          </div>

          <CallLogPanel
            events={filtered}
            totalEvents={events.length}
            counts={counts}
            keyword={keyword}
            onKeyword={setKeyword}
            status={status}
            onStatus={setStatus}
            toolCode={toolCode}
            onClearTool={() => setToolCode('')}
            visible={visible}
            onLoadMore={() => setVisible((value) => value + PAGE_SIZE)}
            onOpen={setDetail}
          />
        </>
      ) : null}

      {detail ? (
        <CallDetailDrawer event={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  );
}
