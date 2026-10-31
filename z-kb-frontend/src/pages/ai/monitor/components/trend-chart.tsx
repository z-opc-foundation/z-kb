import type { TrendPoint } from '@/pages/ai/monitor/mock';

const BAR_HEIGHT = 148;

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.total));
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  return (
    <div className="ai-monitor-trend">
      <div className="trend-head">
        <div className="legend">
          <span className="lg">
            <i className="swatch ok" />
            成功
          </span>
          <span className="lg">
            <i className="swatch fail" />
            失败 / 超时
          </span>
        </div>
      </div>
      <div className="trend-plot">
        {points.map((point, index) => {
          const okHeight = Math.round((point.success / max) * BAR_HEIGHT);
          const failHeight = Math.round((point.failed / max) * BAR_HEIGHT);
          const showLabel = index % labelStep === 0;
          return (
            <div className="trend-col" key={point.key}>
              <div
                className="trend-bars"
                style={{ height: BAR_HEIGHT }}
                title={`${point.label} · 成功 ${point.success} · 失败/超时 ${point.failed}`}
              >
                <i
                  className="seg fail"
                  style={{
                    height: point.failed ? Math.max(2, failHeight) : 0,
                  }}
                />
                <i
                  className="seg ok"
                  style={{
                    height: point.success ? Math.max(2, okHeight) : 0,
                  }}
                />
              </div>
              <span className="trend-x">{showLabel ? point.label : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
