import Icon from '@/components/icon';
import type { QueueItem } from '@/pages/admin/monitor/mock';

export default function QueuePanel({ items }: { items: QueueItem[] }) {
  const waitingTotal = items.reduce((sum, item) => sum + item.waiting, 0);
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="layers" size={14} />
          队列与调度
        </h3>
        <div className="actions">
          <span className="note">等待合计 {waitingTotal} 条</span>
        </div>
      </div>
      <div className="panel-body sys-queues">
        {items.map((item) => {
          const ratio = Math.min(100, (item.waiting / item.capacity) * 100);
          const tone = ratio >= 40 ? 'red' : ratio >= 15 ? 'amber' : 'green';
          return (
            <div className="sys-queue-row" key={item.key}>
              <div className="sys-queue-head">
                <b>{item.label}</b>
                <span className="sys-queue-meta">
                  等待 <b>{item.waiting}</b>
                  <span className="sep">·</span>
                  执行 {item.running}
                  <span className="sep">·</span>
                  失败{' '}
                  <b className={item.failed ? 'bad' : ''}>{item.failed}</b>
                </span>
              </div>
              <span className={`progress ${tone}`}>
                <i style={{ width: `${Math.max(2, ratio)}%` }} />
              </span>
              <small>队列上限 {item.capacity} 条</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
