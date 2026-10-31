import Icon from '@/components/icon';
import type { TrendPoint } from '@/pages/admin/monitor/mock';

const BAR_HEIGHT = 168;

export default function TrafficPanel({
  points,
  rangeLabel,
}: {
  points: TrendPoint[];
  rangeLabel: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.total));
  const peak = points.reduce(
    (best, point) => (point.total > best.total ? point : best),
    points[0],
  );
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="activity" size={14} />
          请求量趋势
          <span className="hint">{rangeLabel}</span>
        </h3>
        <div className="actions">
          <span className="note">
            峰值 {peak.total.toFixed(1)} 次/秒 · {peak.label}
          </span>
        </div>
      </div>
      <div className="panel-body tight">
        <div className="sys-traffic-head">
          <span className="lg">
            <i className="swatch ok" />
            正常
          </span>
          <span className="lg">
            <i className="swatch fail" />
            失败
          </span>
        </div>
        <div className="sys-traffic-plot">
          {points.map((point, index) => {
            const okHeight = Math.round((point.ok / max) * BAR_HEIGHT);
            const failHeight = Math.round((point.failed / max) * BAR_HEIGHT);
            return (
              <div className="sys-traffic-col" key={point.key}>
                <div
                  className="sys-traffic-bars"
                  style={{ height: BAR_HEIGHT }}
                  title={`${point.label} · ${point.total.toFixed(1)} 次/秒 · 失败 ${point.failed}`}
                >
                  <i
                    className="seg fail"
                    style={{ height: point.failed ? Math.max(2, failHeight) : 0 }}
                  />
                  <i
                    className="seg ok"
                    style={{ height: Math.max(2, okHeight) }}
                  />
                </div>
                <span className="sys-traffic-x">
                  {index % labelStep === 0 ? point.label : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
