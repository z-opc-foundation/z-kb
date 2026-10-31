import Icon from '@/components/icon';
import type { ToolMetric } from '@/pages/ai/metrics/mock';

export default function ToolTable({ tools }: { tools: ToolMetric[] }) {
  return (
    <section className="panel ai-metrics-panel">
      <div className="panel-head">
        <h3>
          <Icon name="workflow" size={14} />
          工具维度
        </h3>
        <div className="actions">
          <span className="note">含远端与本地工具</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table ai-metrics-table">
          <thead>
            <tr>
              <th>工具</th>
              <th>调用</th>
              <th>成功率</th>
              <th>平均耗时</th>
              <th>P95</th>
              <th>超时率</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.key}>
                <td>
                  <div className="ai-name-cell">
                    <b>{tool.name}</b>
                    <small>{tool.code}</small>
                  </div>
                </td>
                <td className="mono-sm">{tool.calls.toLocaleString()}</td>
                <td>
                  <div className="ai-metrics-rate">
                    <span className="progress">
                      <i style={{ width: `${tool.successRate}%` }} />
                    </span>
                    <b>{tool.successRate.toFixed(2)}%</b>
                  </div>
                </td>
                <td className="mono-sm">{tool.avgMs.toLocaleString()} ms</td>
                <td className="mono-sm">{tool.p95Ms.toLocaleString()} ms</td>
                <td className="mono-sm">{tool.timeoutRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
