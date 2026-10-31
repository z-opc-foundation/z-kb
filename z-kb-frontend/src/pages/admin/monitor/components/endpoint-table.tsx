import Icon from '@/components/icon';
import type { EndpointMetric } from '@/pages/admin/monitor/mock';

export default function EndpointTable({ items }: { items: EndpointMetric[] }) {
  return (
    <section className="panel sys-monitor-panel">
      <div className="panel-head">
        <h3>
          <Icon name="workflow" size={14} />
          接口性能
        </h3>
        <div className="actions">
          <span className="note">按 QPS 排序</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table sys-endpoint-table">
          <thead>
            <tr>
              <th>接口</th>
              <th>QPS</th>
              <th>P95</th>
              <th>错误率</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>
                  <div className="name-cell">
                    <span className={`sys-method ${item.method.toLowerCase()}`}>
                      {item.method}
                    </span>
                    <span className="mono-sm sys-endpoint-path">{item.path}</span>
                  </div>
                </td>
                <td className="mono-sm">{item.qps.toFixed(1)}</td>
                <td className="mono-sm">{item.p95Ms.toLocaleString()} ms</td>
                <td className="mono-sm">{item.errorRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
