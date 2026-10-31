import Icon from '@/components/icon';
import type { ModelMetric } from '@/pages/ai/metrics/mock';

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function ModelTable({ models }: { models: ModelMetric[] }) {
  return (
    <section className="panel ai-metrics-panel">
      <div className="panel-head">
        <h3>
          <Icon name="brain" size={14} />
          模型维度
        </h3>
        <div className="actions">
          <span className="note">按调用量排序</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table ai-metrics-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>用途</th>
              <th>调用</th>
              <th>成功率</th>
              <th>平均耗时</th>
              <th>P95</th>
              <th>输入 Token</th>
              <th>输出 Token</th>
              <th>估算成本</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.key}>
                <td>
                  <div className="ai-name-cell">
                    <b>{model.model}</b>
                    <small>{model.key === 'local-standin' ? '本地确定性替身' : 'galaxy 远端'}</small>
                  </div>
                </td>
                <td>
                  <span className="tag gray sm">{model.usage}</span>
                </td>
                <td className="mono-sm">{model.calls.toLocaleString()}</td>
                <td>
                  <div className="ai-metrics-rate">
                    <span className="progress">
                      <i style={{ width: `${model.successRate}%` }} />
                    </span>
                    <b>{model.successRate.toFixed(2)}%</b>
                  </div>
                </td>
                <td className="mono-sm">{model.avgMs.toLocaleString()} ms</td>
                <td className="mono-sm">{model.p95Ms.toLocaleString()} ms</td>
                <td className="mono-sm">{formatTokens(model.inputTokens)}</td>
                <td className="mono-sm">
                  {model.outputTokens ? formatTokens(model.outputTokens) : '—'}
                </td>
                <td className="mono-sm">
                  {model.cost > 0 ? `¥ ${model.cost.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
