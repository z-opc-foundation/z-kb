import Icon from '@/components/icon';
import { AUDIT_STATS_DAYS, type AuditStats } from './use-audit-stats';

const SUCCESS_COLOR = '#1f9d6b';
const FAILED_COLOR = '#d94a4a';
const SYS_COLOR = '#7c8aa0';
const KB_COLOR = '#7f6cf0';

function duration(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
}

function barWidth(count: number, max: number): string {
  return `${Math.max(2, (count / Math.max(1, max)) * 100)}%`;
}

export interface AuditStatsPanelProps {
  stats: AuditStats | null;
  error: string;
  onRetry: () => void;
  showType: boolean;
  actorNames: Record<number, string>;
}

/** 审计统计：结果口径、耗时、Top 动作与操作人、近 14 天操作量。 */
export default function AuditStatsPanel({
  stats,
  error,
  onRetry,
  showType,
  actorNames,
}: AuditStatsPanelProps) {
  if (error) {
    return (
      <section className="panel audit-stat-shell">
        <div className="callout danger" style={{ margin: 16 }}>
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>统计数据加载失败</b>
            <p>{error}</p>
            <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={onRetry}>
              重试
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="panel audit-stat-shell">
        <div className="empty">
          <span className="empty-icon">
            <span className="spinner" />
          </span>
          <b>正在汇总审计数据…</b>
          <p>按当前筛选范围回扫明细后聚合。</p>
        </div>
      </section>
    );
  }

  const truncated = stats.scanned < stats.total;
  const dayMax = Math.max(1, ...stats.byDay.map((day) => day.total));
  const actionMax = Math.max(1, ...stats.byAction.map((item) => item.count));
  const actorMax = Math.max(1, ...stats.byActor.map((item) => item.count));
  const resultMax = Math.max(1, stats.success, stats.failed, stats.byType.sys, stats.byType.kb);
  const hasTrend = stats.byDay.some((day) => day.total > 0);

  const actorLabel = (key: string) => {
    if (key === 'unknown') {
      return '未知操作人';
    }
    const actorId = Number(key);
    return actorNames[actorId] || `actorId ${key}`;
  };

  return (
    <div className="audit-stats">
      <div className="obs-metrics audit-stat-kpis">
        <div className="obs-metric">
          <div className="k">匹配记录</div>
          <div className="v tnum">
            {stats.total}
            <small>条</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">成功</div>
          <div className="v tnum">
            {stats.success}
            <small>次</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">失败</div>
          <div className="v tnum">
            {stats.failed}
            <small>次</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">成功率</div>
          <div className="v tnum">
            {stats.successRate == null ? '—' : stats.successRate}
            <small>{stats.successRate == null ? '' : '%'}</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">平均耗时</div>
          <div className="v tnum">{duration(stats.avgDurationMs)}</div>
        </div>
        <div className="obs-metric">
          <div className="k">P95 耗时</div>
          <div className="v tnum">{duration(stats.p95DurationMs)}</div>
        </div>
      </div>

      <div className="grid grid-2 audit-stat-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="bar-chart" size={14} />
              近 {AUDIT_STATS_DAYS} 天操作量
            </h3>
            <div className="obs-legend">
              <span>
                <i style={{ background: SUCCESS_COLOR }} />
                成功
              </span>
              <span>
                <i style={{ background: FAILED_COLOR }} />
                失败
              </span>
            </div>
          </div>
          <div className="panel-body">
            {hasTrend ? (
              <div className="obs-chart audit-stat-chart">
                {stats.byDay.map((day) => (
                  <div className="obs-col" key={day.key} title={`${day.key} · ${day.total} 条`}>
                    <div className="obs-stack">
                      {day.success ? (
                        <div
                          className="obs-seg"
                          style={{
                            height: `${(day.success / dayMax) * 100}%`,
                            background: SUCCESS_COLOR,
                            minHeight: 3,
                          }}
                        />
                      ) : null}
                      {day.failed ? (
                        <div
                          className="obs-seg"
                          style={{
                            height: `${(day.failed / dayMax) * 100}%`,
                            background: FAILED_COLOR,
                            minHeight: 3,
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="obs-x">{day.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <b>近 {AUDIT_STATS_DAYS} 天没有操作记录</b>
                <p>更早的数据仍计入上方总数与分布。</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="activity" size={14} />
              高频动作
            </h3>
            <span className="hint">最多展示 8 项</span>
          </div>
          <div className="panel-body">
            {stats.byAction.length ? (
              <div className="obs-bars audit-stat-bars">
                {stats.byAction.slice(0, 8).map((item) => (
                  <div className="obs-bar-row" key={item.key}>
                    <span className="obs-bar-label" title={item.key}>
                      {item.key}
                    </span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{
                          width: barWidth(item.count, actionMax),
                          background: '#2f7cf6',
                        }}
                      />
                    </span>
                    <span className="obs-val tnum">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <b>暂无可统计的动作</b>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="user" size={14} />
              操作人分布
            </h3>
            <span className="hint">共 {stats.actorCount} 人</span>
          </div>
          <div className="panel-body">
            {stats.byActor.length ? (
              <div className="obs-bars audit-stat-bars">
                {stats.byActor.slice(0, 8).map((item) => (
                  <div className="obs-bar-row" key={item.key}>
                    <span className="obs-bar-label" title={actorLabel(item.key)}>
                      {actorLabel(item.key)}
                    </span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{
                          width: barWidth(item.count, actorMax),
                          background: '#26a69a',
                        }}
                      />
                    </span>
                    <span className="obs-val tnum">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <b>暂无可统计的操作人</b>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="pie-chart" size={14} />
              结果与归属
            </h3>
            <span className="hint">按记录条数</span>
          </div>
          <div className="panel-body">
            <div className="obs-bars audit-stat-bars">
              <div className="obs-bar-row">
                <span className="obs-bar-label">成功</span>
                <span className="obs-track">
                  <span
                    className="obs-fill"
                    style={{ width: barWidth(stats.success, resultMax), background: SUCCESS_COLOR }}
                  />
                </span>
                <span className="obs-val tnum">{stats.success}</span>
              </div>
              <div className="obs-bar-row">
                <span className="obs-bar-label">失败</span>
                <span className="obs-track">
                  <span
                    className="obs-fill"
                    style={{ width: barWidth(stats.failed, resultMax), background: FAILED_COLOR }}
                  />
                </span>
                <span className="obs-val tnum">{stats.failed}</span>
              </div>
              {showType ? (
                <>
                  <div className="obs-bar-row">
                    <span className="obs-bar-label">系统</span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{ width: barWidth(stats.byType.sys, resultMax), background: SYS_COLOR }}
                      />
                    </span>
                    <span className="obs-val tnum">{stats.byType.sys}</span>
                  </div>
                  <div className="obs-bar-row">
                    <span className="obs-bar-label">知识库</span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{ width: barWidth(stats.byType.kb, resultMax), background: KB_COLOR }}
                      />
                    </span>
                    <span className="obs-val tnum">{stats.byType.kb}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className="audit-stat-scope">
        {truncated
          ? `统计基于最近 ${stats.scanned} 条记录（共匹配 ${stats.total} 条），占比与 Top 排名按取样计算`
          : `统计覆盖全部 ${stats.total} 条匹配记录`}
      </div>
    </div>
  );
}
