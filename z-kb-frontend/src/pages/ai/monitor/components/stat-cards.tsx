import Icon from '@/components/icon';
import type { MonitorSnapshot } from '@/pages/ai/monitor/mock';

interface StatCardsProps {
  snapshot?: MonitorSnapshot;
  previous?: MonitorSnapshot;
}

function Delta({
  value,
  suffix,
  lowerIsBetter = false,
}: {
  value: number | null;
  suffix: string;
  lowerIsBetter?: boolean;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span className="foot">暂无可比周期</span>;
  }
  if (Math.abs(value) < 0.05) {
    return <span className="foot">与上一周期持平</span>;
  }
  const rising = value > 0;
  const good = lowerIsBetter ? !rising : rising;
  return (
    <span className="foot">
      <span className={good ? 'up' : 'down'}>
        {rising ? '↑' : '↓'} {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
      较上一周期
    </span>
  );
}

function pctChange(current: number, before: number | undefined): number | null {
  if (before === undefined || before === 0) {
    return null;
  }
  return ((current - before) / before) * 100;
}

export default function StatCards({ snapshot, previous }: StatCardsProps) {
  const stats = snapshot?.stats;
  const before = previous?.stats;
  const total = stats?.total;
  const successRate = stats?.successRate;
  const p95 = stats?.p95Ms;
  const failed = stats?.failed;

  return (
    <div className="grid grid-4 ai-monitor-stats">
      <div className="stat">
        <div className="label">
          <Icon name="activity" size={13} />
          总调用
        </div>
        <div className="value">
          {total === undefined ? '—' : total.toLocaleString()}
          <small>次</small>
        </div>
        <Delta
          value={total === undefined ? null : pctChange(total, before?.total)}
          suffix="%"
        />
        <span className="s-icon">
          <Icon name="activity" size={15} />
        </span>
      </div>

      <div className="stat green">
        <div className="label">
          <Icon name="check-circle" size={13} />
          成功率
        </div>
        <div className="value">
          {successRate === undefined ? '—' : successRate.toFixed(1)}
          <small>%</small>
        </div>
        <Delta
          value={
            successRate === undefined || before === undefined
              ? null
              : successRate - before.successRate
          }
          suffix="pp"
        />
        <span className="s-icon">
          <Icon name="check-circle" size={15} />
        </span>
      </div>

      <div className="stat amber">
        <div className="label">
          <Icon name="clock" size={13} />
          P95 耗时
        </div>
        <div className="value">
          {p95 === undefined ? '—' : p95.toLocaleString()}
          <small>ms</small>
        </div>
        <Delta
          value={
            p95 === undefined || before === undefined ? null : p95 - before.p95Ms
          }
          suffix=" ms"
          lowerIsBetter
        />
        <span className="s-icon">
          <Icon name="clock" size={15} />
        </span>
      </div>

      <div className="stat red">
        <div className="label">
          <Icon name="alert-triangle" size={13} />
          失败 + 超时
        </div>
        <div className="value">
          {failed === undefined ? '—' : failed.toLocaleString()}
          <small>次</small>
        </div>
        <Delta
          value={
            failed === undefined || before === undefined
              ? null
              : failed - before.failed
          }
          suffix=" 次"
          lowerIsBetter
        />
        <span className="s-icon">
          <Icon name="alert-triangle" size={15} />
        </span>
      </div>
    </div>
  );
}
