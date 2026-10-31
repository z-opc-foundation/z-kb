import Icon from '@/components/icon';
import type { ResourceItem } from '@/pages/ai/metrics/mock';

function formatUsage(item: ResourceItem): string {
  if (item.unit === '%') {
    return `${item.used}%`;
  }
  return `${item.used} / ${item.capacity} ${item.unit}`;
}

export default function ResourcePanel({ items }: { items: ResourceItem[] }) {
  return (
    <section className="panel ai-metrics-panel">
      <div className="panel-head">
        <h3>
          <Icon name="database" size={14} />
          资源水位
        </h3>
      </div>
      <div className="panel-body ai-metrics-resources">
        {items.map((item) => {
          const ratio = Math.min(100, (item.used / item.capacity) * 100);
          const tone = ratio >= 80 ? 'red' : ratio >= 60 ? 'amber' : '';
          return (
            <div className="res-row" key={item.key}>
              <div className="res-head">
                <b>{item.label}</b>
                <span className="mono-sm">{formatUsage(item)}</span>
              </div>
              <span className={`progress ${tone}`.trim()}>
                <i style={{ width: `${ratio}%` }} />
              </span>
              <small>{item.note}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
