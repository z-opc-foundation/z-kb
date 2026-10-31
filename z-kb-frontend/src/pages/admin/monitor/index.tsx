import Icon from '@/components/icon';
import AlertTable from '@/pages/admin/monitor/components/alert-table';
import EndpointTable from '@/pages/admin/monitor/components/endpoint-table';
import QueuePanel from '@/pages/admin/monitor/components/queue-panel';
import ResourceGauges from '@/pages/admin/monitor/components/resource-gauges';
import ServiceHealth from '@/pages/admin/monitor/components/service-health';
import StatCards from '@/pages/admin/monitor/components/stat-cards';
import TrafficPanel from '@/pages/admin/monitor/components/traffic-panel';
import { useSystemMonitor } from '@/pages/admin/monitor/hooks/use-system-monitor';
import {
  MONITOR_RANGE_OPTIONS,
  type MonitorRange,
} from '@/pages/admin/monitor/mock';
import { AiLoading } from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import '@/pages/admin/monitor/monitor.less';
import { useState } from 'react';

export default function SystemMonitorPage() {
  const [range, setRange] = useState<MonitorRange>('24h');
  const { loading, snapshot, refresh } = useSystemMonitor(range);
  const rangeLabel =
    MONITOR_RANGE_OPTIONS.find((option) => option.value === range)?.label ||
    '最近 24 小时';

  return (
    <div className="view sys-monitor">
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
          <AiLoading text="正在汇总运行状态…" />
        </section>
      ) : snapshot ? (
        <>
          <StatCards stats={snapshot.stats} previous={snapshot.previous} />

          <div className="grid sys-monitor-row-main">
            <TrafficPanel points={snapshot.trend} rangeLabel={rangeLabel} />
            <ResourceGauges items={snapshot.resources} />
          </div>

          <ServiceHealth services={snapshot.services} />

          <div className="grid sys-monitor-row-split">
            <EndpointTable items={snapshot.endpoints} />
            <QueuePanel items={snapshot.queues} />
          </div>

          <AlertTable alerts={snapshot.alerts} />
        </>
      ) : null}
    </div>
  );
}
