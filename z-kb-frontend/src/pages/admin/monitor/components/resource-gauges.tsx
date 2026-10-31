import Icon from '@/components/icon';
import type { ResourceGauge } from '@/pages/admin/monitor/mock';

function formatUsage(item: ResourceGauge): string {
  if (item.unit === '%') {
    return `${item.used}%`;
  }
  return `${item.used} / ${item.capacity} ${item.unit}`;
}

export default function ResourceGauges({ items }: { items: ResourceGauge[] }) {
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="database" size={14} />
          资源水位
        </h3>
      </div>
      <div className="panel-body sys-gauges">
        {items.map((item) => {
          const ratio = Math.min(100, (item.used / item.capacity) * 100);
          const tone = ratio >= 80 ? 'red' : ratio >= 60 ? 'amber' : '';
          return (
            <div className="sys-gauge-row" key={item.key}>
              <div className="sys-gauge-head">
                <b>{item.label}</b>
                <span className="mono-sm">{formatUsage(item)}</span>
              </div>
              <span className={`progress ${tone}`.trim()}>
                <i style={{ width: `${Math.max(2, ratio)}%` }} />
              </span>
              <small>{item.note}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
