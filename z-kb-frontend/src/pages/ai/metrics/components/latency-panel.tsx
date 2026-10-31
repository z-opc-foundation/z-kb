import Icon from '@/components/icon';
import type { LatencyPercentiles, LatencyStage } from '@/pages/ai/metrics/mock';

interface LatencyPanelProps {
  latency: LatencyPercentiles;
  stages: LatencyStage[];
}

export default function LatencyPanel({ latency, stages }: LatencyPanelProps) {
  const percentiles = [
    { key: 'p50', label: 'P50', ms: latency.p50 },
    { key: 'p90', label: 'P90', ms: latency.p90 },
    { key: 'p95', label: 'P95', ms: latency.p95 },
    { key: 'p99', label: 'P99', ms: latency.p99 },
  ];
  const maxPercentile = Math.max(1, ...percentiles.map((item) => item.ms));
  const maxStage = Math.max(1, ...stages.map((item) => item.ms));

  return (
    <section className="panel ai-metrics-panel">
      <div className="panel-head">
        <h3>
          <Icon name="clock" size={14} />
          延迟分位与链路耗时
        </h3>
      </div>
      <div className="panel-body ai-metrics-latency">
        <div className="lat-group">
          {percentiles.map((item) => (
            <div className="lat-row" key={item.key}>
              <span className="lat-label">{item.label}</span>
              <span className="progress">
                <i style={{ width: `${(item.ms / maxPercentile) * 100}%` }} />
              </span>
              <b className="lat-value">{item.ms.toLocaleString()} ms</b>
            </div>
          ))}
        </div>

        <div className="lat-divider">
          <span>链路耗时（单次平均）</span>
        </div>

        <div className="lat-group">
          {stages.map((stage) => (
            <div className="lat-row" key={stage.key}>
              <span className="lat-label">{stage.label}</span>
              <span className="progress violet">
                <i style={{ width: `${(stage.ms / maxStage) * 100}%` }} />
              </span>
              <b className="lat-value">
                {stage.ms.toLocaleString()} ms
                <small>{stage.share.toFixed(0)}%</small>
              </b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
