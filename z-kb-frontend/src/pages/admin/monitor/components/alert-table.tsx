import Icon from '@/components/icon';
import {
  ALERT_LEVEL_LABEL,
  ALERT_LEVEL_TONE,
  ALERT_STATUS_LABEL,
  formatDayTime,
  type AlertItem,
} from '@/pages/admin/monitor/mock';

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

export default function AlertTable({ alerts }: { alerts: AlertItem[] }) {
  const firing = alerts.filter((item) => item.status === 'firing').length;
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="bell" size={14} />
          告警
        </h3>
        <div className="actions">
          <span className="note">
            {firing} 条未恢复 · 共 {alerts.length} 条
          </span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table sys-alert-table">
          <thead>
            <tr>
              <th>级别</th>
              <th>对象</th>
              <th>告警内容</th>
              <th>首次发生</th>
              <th>持续</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>
                  <span className={`tag sm ${ALERT_LEVEL_TONE[alert.level]}`}>
                    {ALERT_LEVEL_LABEL[alert.level]}
                  </span>
                </td>
                <td>{alert.target}</td>
                <td className="sys-alert-title">{alert.title}</td>
                <td className="mono-sm">{formatDayTime(alert.sinceAt)}</td>
                <td className="mono-sm">{formatDuration(alert.durationMin)}</td>
                <td>
                  <span
                    className={`tag sm ${
                      alert.status === 'firing' ? 'red' : 'green'
                    }`}
                  >
                    {ALERT_STATUS_LABEL[alert.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
