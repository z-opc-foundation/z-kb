import Icon from '@/components/icon';
import LatencyPanel from '@/pages/ai/metrics/components/latency-panel';
import ModelTable from '@/pages/ai/metrics/components/model-table';
import ResourcePanel from '@/pages/ai/metrics/components/resource-panel';
import SloPanel from '@/pages/ai/metrics/components/slo-panel';
import SummaryCards from '@/pages/ai/metrics/components/summary-cards';
import ThroughputPanel from '@/pages/ai/metrics/components/throughput-panel';
import ToolTable from '@/pages/ai/metrics/components/tool-table';
import { useMetrics } from '@/pages/ai/metrics/hooks/use-metrics';
import {
  METRICS_RANGE_OPTIONS,
  type MetricsRange,
} from '@/pages/ai/metrics/mock';
import { AiLoading } from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import '@/pages/ai/metrics/metrics.less';
import { useState } from 'react';

export default function AiMetricsPage() {
  const [range, setRange] = useState<MetricsRange>('24h');
  const { loading, snapshot, refresh } = useMetrics(range);
  const rangeLabel =
    METRICS_RANGE_OPTIONS.find((option) => option.value === range)?.label ||
    '最近 24 小时';

  return (
    <div className="view ai-metrics">
      <div className="view-bar">
        <span className="tag amber">演示数据</span>
        <span className="spacer" />
        <div className="segmented">
          {METRICS_RANGE_OPTIONS.map((option) => (
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
          <AiLoading text="正在汇总技术指标…" />
        </section>
      ) : snapshot ? (
        <>
          <SummaryCards summary={snapshot.summary} previous={snapshot.previous} />

          <div className="ai-metrics-row ai-metrics-row-main">
            <ThroughputPanel points={snapshot.throughput} rangeLabel={rangeLabel} />
            <ResourcePanel items={snapshot.resources} />
          </div>

          <div className="grid grid-2 ai-metrics-row">
            <LatencyPanel latency={snapshot.latency} stages={snapshot.stages} />
            <SloPanel items={snapshot.slos} />
          </div>

          <div className="ai-metrics-row">
            <ModelTable models={snapshot.models} />
          </div>

          <div className="ai-metrics-row">
            <ToolTable tools={snapshot.tools} />
          </div>
        </>
      ) : null}
    </div>
  );
}
