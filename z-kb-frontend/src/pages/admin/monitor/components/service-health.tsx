import Icon from '@/components/icon';
import {
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_TONE,
  type ServiceHealth as ServiceHealthItem,
} from '@/pages/admin/monitor/mock';

export default function ServiceHealth({
  services,
}: {
  services: ServiceHealthItem[];
}) {
  const unhealthy = services.filter((item) => item.status !== 'healthy').length;
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="network" size={14} />
          服务健康
        </h3>
        <div className="actions">
          <span className="note">
            {services.length - unhealthy} / {services.length} 正常
          </span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table sys-service-table">
          <thead>
            <tr>
              <th>服务</th>
              <th>状态</th>
              <th>实例</th>
              <th>可用性</th>
              <th>P95</th>
              <th>错误率</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.key}>
                <td>
                  <div className="name-cell">
                    <span className="sys-service-ic">
                      <Icon name="package" size={13} />
                    </span>
                    <div className="nc">
                      <b>{service.name}</b>
                      <small>
                        {service.code} · {service.group} · {service.version}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`tag sm ${SERVICE_STATUS_TONE[service.status]}`}>
                    <i className="dot" />
                    {SERVICE_STATUS_LABEL[service.status]}
                  </span>
                </td>
                <td className="mono-sm">{service.instances}</td>
                <td className="mono-sm">{service.uptime.toFixed(2)}%</td>
                <td className="mono-sm">{service.latencyMs.toLocaleString()} ms</td>
                <td className="mono-sm">{service.errorRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
