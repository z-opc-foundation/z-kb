import Icon from '@/components/icon';
import type { MonitorStats } from '@/pages/admin/monitor/mock';

interface StatCardsProps {
  stats: MonitorStats;
  previous: MonitorStats;
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

function pctChange(current: number, before: number): number | null {
  if (!before) {
    return null;
  }
  return ((current - before) / before) * 100;
}

export default function StatCards({ stats, previous }: StatCardsProps) {
  return (
    <div className="grid grid-4 sys-monitor-stats">
      <div className="stat green">
        <div className="label">
          <Icon name="check-circle" size={13} />
          服务在线
        </div>
        <div className="value">
          {stats.servicesUp}
          <small>/ {stats.servicesTotal} 个</small>
        </div>
        <span className="foot">按健康检查结果统计</span>
        <span className="s-icon">
          <Icon name="check-circle" size={15} />
        </span>
      </div>

      <div className="stat">
        <div className="label">
          <Icon name="activity" size={13} />
          峰值 QPS
        </div>
        <div className="value">
          {stats.peakQps.toFixed(1)}
          <small>次/秒</small>
        </div>
        <Delta
          value={pctChange(stats.peakQps, previous.peakQps)}
          suffix="%"
        />
        <span className="s-icon">
          <Icon name="activity" size={15} />
        </span>
      </div>

      <div className="stat amber">
        <div className="label">
          <Icon name="clock" size={13} />
          P95 响应
        </div>
        <div className="value">
          {stats.p95Ms.toLocaleString()}
          <small>ms</small>
        </div>
        <Delta
          value={stats.p95Ms - previous.p95Ms}
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
          未恢复告警
        </div>
        <div className="value">
          {stats.alertsFiring}
          <small>条</small>
        </div>
        <Delta
          value={stats.alertsFiring - previous.alertsFiring}
          suffix=" 条"
          lowerIsBetter
        />
        <span className="s-icon">
          <Icon name="alert-triangle" size={15} />
        </span>
      </div>
    </div>
  );
}
