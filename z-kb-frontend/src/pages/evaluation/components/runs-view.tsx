import Icon from '@/components/icon';
import type { EvalOverview, EvalRunRecord } from '@/services/evaluation';
import {
  availabilityMeta,
  EmptyState,
  fmtDuration,
  fmtTime,
  runStatusMeta,
  StatusTag,
  Tag,
} from './shared';

interface RunsViewProps {
  overview?: EvalOverview | null;
  runs: EvalRunRecord[];
  currentRunId?: string;
  baselineRunId?: string;
  onOpenRun: (runId: string) => void;
  onSetBaseline: (runId?: string) => void;
  onCreateRun: () => void;
}

export default function RunsView({
  overview,
  runs,
  currentRunId,
  baselineRunId,
  onOpenRun,
  onSetBaseline,
  onCreateRun,
}: RunsViewProps) {
  const options = runs.filter((item) => item.runId !== currentRunId);

  return (
    <div>
      <div className="grid grid-3 mb-16">
        <div className="stat">
          <div className="label">本会话已知跑批</div>
          <div className="value tnum">{runs.length}</div>
          <div className="foot">仅汇总已查询到的真实记录</div>
          <div className="s-icon">
            <Icon name="play" size={15} />
          </div>
        </div>
        <div className="stat violet">
          <div className="label">当前结果</div>
          <div className="value tnum" style={{ fontSize: 18 }}>
            <span className="mono">{currentRunId || '—'}</span>
          </div>
          <div className="foot">用于本次结果 / 指标 / 阶段</div>
          <div className="s-icon">
            <Icon name="check-circle" size={15} />
          </div>
        </div>
        <div className="stat green">
          <div className="label">本次 基线</div>
          <div className="value tnum" style={{ fontSize: 18 }}>
            <span className="mono">{baselineRunId || '未指定'}</span>
          </div>
          <div className="foot">基线只用于对照，不改写历史结果</div>
          <div className="s-icon">
            <Icon name="git-compare" size={15} />
          </div>
        </div>
      </div>

      <div className="eval-context">
        <div className="ec-left">
          <b>历史对照</b>
          <span>
            当前数据集{' '}
            <span className="mono">
              {overview?.dataset?.versionNo || '—'}
            </span>
          </span>
          <span>选择可选基线后，可在概览中读取基线信息</span>
        </div>
        <div className="ec-right">
          <select
            className="select eval-baseline-select"
            value={baselineRunId || ''}
            onChange={(event) => onSetBaseline(event.target.value || undefined)}
          >
            <option value="">不指定基线</option>
            {options.map((item) => (
              <option key={item.runId} value={item.runId}>
                {item.runId}
                {item.datasetVersionNo ? ` · ${item.datasetVersionNo}` : ''}
                {item.finishedAt ? ` · ${fmtTime(item.finishedAt)}` : ''}
              </option>
            ))}
          </select>
          <button className="btn sm primary" type="button" onClick={onCreateRun}>
            <Icon name="play" size={12} />
            发起跑批
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="play" size={14} />
            跑批记录
            <span className="hint">
              固定数据集、配置与 Judge；失败与不可用记录不删除
            </span>
          </h3>
        </div>
        <div className="table-wrap">
          {runs.length ? (
            <table className="list-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>数据集版本</th>
                  <th>配置版本</th>
                  <th>Judge</th>
                  <th>snapshotId</th>
                  <th>可用性</th>
                  <th>耗时</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const availability = availabilityMeta(run);
                  const status = runStatusMeta(run.status);
                  const isCurrent = run.runId === currentRunId;
                  const isBaseline = run.runId === baselineRunId;
                  return (
                    <tr
                      key={run.runId}
                      className="c-pointer"
                      onClick={() => onOpenRun(run.runId)}
                      style={
                        isCurrent ? { background: 'var(--primary-soft)' } : undefined
                      }
                    >
                      <td>
                        <div className="nc" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <b className="mono">
                            {run.runId}{' '}
                            {isCurrent ? (
                              <Tag tone="violet" className="sm">
                                本次
                              </Tag>
                            ) : null}
                            {isBaseline ? (
                              <Tag tone="green" className="sm">
                                基线
                              </Tag>
                            ) : null}
                          </b>
                          <small className="note">
                            {fmtTime(run.finishedAt || run.startedAt)}
                          </small>
                        </div>
                      </td>
                      <td className="mono-sm">{run.datasetVersionNo || '—'}</td>
                      <td className="mono-sm">{run.configVersion || '—'}</td>
                      <td className="mono-sm">
                        {[run.judgeMode, run.judgeVersion].filter(Boolean).join(' · ') ||
                          '—'}
                      </td>
                      <td className="mono-sm ellipsis" title={run.snapshotId || ''}>
                        {run.snapshotId || '—'}
                      </td>
                      <td>
                        <StatusTag meta={availability} />
                      </td>
                      <td className="mono-sm">{fmtDuration(run.durationMs)}</td>
                      <td>
                        <StatusTag meta={status} />
                      </td>
                      <td>
                        <div className="row gap-4">
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenRun(run.runId);
                            }}
                          >
                            查看
                          </button>
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSetBaseline(
                                isBaseline ? undefined : run.runId,
                              );
                            }}
                          >
                            {isBaseline ? '取消基线' : '设为基线'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon="play"
              title="还没有已加载的跑批记录"
              description="当前契约未提供历史跑批分页接口，本表只汇总本会话查询到的真实跑批；通过 runId 深链可直接恢复。"
              action={
                <button className="btn primary" type="button" onClick={onCreateRun}>
                  <Icon name="play" size={13} />
                  发起跑批
                </button>
              }
            />
          )}
        </div>
        <div className="panel-foot">
          <span>跑批只生成结果，不阻断发布；失败与不可用记录不删除</span>
          <span className="note">
            {runs.length} 条 · 会话缓存按租户与知识库隔离
          </span>
        </div>
      </section>

      <div className="callout mt-16">
        <Icon name="info" size={15} />
        <div className="ct">
          <b>什么时候可以发起</b>
          <p>
            编译、审批与索引完成后由用户自助发起；同库、同数据集、同配置、同 Judge
            在两小时内已完成过跑批时，后端会优先复用上次结果。
          </p>
        </div>
      </div>
    </div>
  );
}
