import Icon from '@/components/icon';
import type { SloItem } from '@/pages/ai/metrics/mock';

export default function SloPanel({ items }: { items: SloItem[] }) {
  const metCount = items.filter((item) => item.met).length;
  return (
    <section className="panel ai-metrics-panel">
      <div className="panel-head">
        <h3>
          <Icon name="target" size={14} />
          SLO 达成
        </h3>
        <div className="actions">
          <span className="note">
            {metCount} / {items.length} 达标
          </span>
        </div>
      </div>
      <div className="panel-body ai-metrics-slo">
        {items.map((item) => (
          <div className="slo-row" key={item.key}>
            <div className="slo-copy">
              <b>{item.label}</b>
              <small>目标 {item.target}</small>
            </div>
            <span className={`progress ${item.met ? 'green' : 'red'}`}>
              <i style={{ width: `${Math.max(6, Math.min(100, item.ratio))}%` }} />
            </span>
            <div className="slo-actual">
              <b>{item.actual}</b>
              <span className={`tag sm ${item.met ? 'green' : 'red'}`}>
                {item.met ? '达成' : '未达成'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
