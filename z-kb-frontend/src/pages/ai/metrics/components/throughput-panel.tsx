import Icon from '@/components/icon';
import type { ThroughputPoint } from '@/pages/ai/metrics/mock';

interface ThroughputPanelProps {
  points: ThroughputPoint[];
  rangeLabel: string;
}

export default function ThroughputPanel({ points, rangeLabel }: ThroughputPanelProps) {
  if (!points.length) {
    return null;
  }
  const max = Math.max(1, ...points.map((point) => point.calls));
  const peak = points.reduce(
    (best, point) => (point.calls > best.calls ? point : best),
    points[0],
  );
  const labelStep = Math.max(1, Math.ceil(points.length / 10));

  return (
    <section className="panel ai-metrics-panel ai-metrics-throughput">
      <div className="panel-head">
        <h3>
          <Icon name="bar-chart" size={14} />
          调用量分布
          <span className="hint">{rangeLabel}</span>
        </h3>
        <div className="actions">
          <span className="note">
            峰值 {peak.calls.toLocaleString()} 次 · {peak.label}
          </span>
        </div>
      </div>
      <div className="panel-body tight">
        <div className="ai-metrics-plot">
          {points.map((point, index) => (
            <div className="col" key={point.key}>
              <div
                className="bars"
                title={`${point.label} · ${point.calls.toLocaleString()} 次`}
              >
                <i
                  style={{
                    height: `${Math.max(1.5, (point.calls / max) * 100)}%`,
                  }}
                />
              </div>
              <span className="x">{index % labelStep === 0 ? point.label : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
