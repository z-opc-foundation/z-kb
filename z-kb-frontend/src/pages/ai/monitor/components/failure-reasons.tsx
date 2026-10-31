import Icon from '@/components/icon';
import type { FailureStat } from '@/pages/ai/monitor/mock';

export default function FailureReasons({
  failureStats,
  failed,
}: {
  failureStats: FailureStat[];
  failed: number;
}) {
  return (
    <section className="panel ai-monitor-failures">
      <div className="panel-head">
        <h3>
          <Icon name="alert-triangle" size={14} />
          失败原因分布
        </h3>
        <div className="actions">
          <span className="note">共 {failed.toLocaleString()} 次失败 / 超时</span>
        </div>
      </div>
      {failureStats.length ? (
        <div className="ai-failure-list">
          {failureStats.map((item) => (
            <div className="ai-failure-row" key={item.label}>
              <span className="fl-label" title={item.label}>
                {item.label}
              </span>
              <span className="progress">
                <i style={{ width: `${Math.max(3, item.share)}%` }} />
              </span>
              <span className="fl-count">
                {item.count} 次 · {item.share.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ai-empty-inline">该时间范围内没有失败调用。</div>
      )}
    </section>
  );
}
