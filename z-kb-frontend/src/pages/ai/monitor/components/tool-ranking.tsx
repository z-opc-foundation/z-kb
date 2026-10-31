import Icon from '@/components/icon';
import type { ToolStat } from '@/pages/ai/monitor/mock';

interface ToolRankingProps {
  toolStats: ToolStat[];
  selectedTool: string;
  onSelect: (toolCode: string) => void;
}

export default function ToolRanking({
  toolStats,
  selectedTool,
  onSelect,
}: ToolRankingProps) {
  return (
    <section className="panel ai-monitor-ranking">
      <div className="panel-head">
        <h3>
          <Icon name="bar-chart" size={14} />
          工具调用排行
        </h3>
      </div>
      <div className="table-wrap">
        <table className="list-table">
          <thead>
            <tr>
              <th>工具</th>
              <th>调用</th>
              <th>成功率</th>
              <th>平均耗时</th>
              <th>P95</th>
            </tr>
          </thead>
          <tbody>
            {toolStats.map((tool) => (
              <tr
                key={tool.toolCode}
                className={`rank-row ${selectedTool === tool.toolCode ? 'selected' : ''}`}
                onClick={() =>
                  onSelect(selectedTool === tool.toolCode ? '' : tool.toolCode)
                }
              >
                <td>
                  <div className="ai-name-cell">
                    <b>{tool.toolName}</b>
                    <small>{tool.toolCode}</small>
                  </div>
                </td>
                <td className="mono-sm">{tool.calls.toLocaleString()}</td>
                <td>
                  <div className="ai-rank-rate">
                    <span className="progress">
                      <i style={{ width: `${tool.successRate}%` }} />
                    </span>
                    <b>{tool.successRate.toFixed(1)}%</b>
                  </div>
                </td>
                <td className="mono-sm">{tool.avgMs.toLocaleString()} ms</td>
                <td className="mono-sm">{tool.p95Ms.toLocaleString()} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
