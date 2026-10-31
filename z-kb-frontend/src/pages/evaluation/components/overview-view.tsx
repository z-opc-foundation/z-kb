import Icon from '@/components/icon';
import type { EvalOverview, EvalRunDetail } from '@/services/evaluation';
import {
  availabilityMeta,
  datasetStatusMeta,
  EmptyState,
  ErrorState,
  EvidenceList,
  fmtDuration,
  fmtMetricValue,
  fmtTime,
  LoadingState,
  metricStatusMeta,
  NotConnectedList,
  StatusTag,
  Tag,
} from './shared';

interface OverviewViewProps {
  overview?: EvalOverview | null;
  runDetail?: EvalRunDetail | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onCreateRun: () => void;
  onEditDataset: () => void;
  onOpenResult: () => void;
  onOpenCases: () => void;
  onOpenTrust: () => void;
}

export default function OverviewView({
  overview,
  runDetail,
  loading,
  error,
  onRetry,
  onCreateRun,
  onEditDataset,
  onOpenResult,
  onOpenCases,
  onOpenTrust,
}: OverviewViewProps) {
  if (loading) {
    return (
      <section className="panel">
        <LoadingState title="正在加载单库评测概览…" />
      </section>
    );
  }
  if (error && !overview) {
    return (
      <section className="panel">
        <ErrorState
          title="评测概览加载失败"
          description="queryOverview 返回异常；页面不会用本地样本补齐库级信息。"
          onRetry={onRetry}
        />
      </section>
    );
  }

  const dataset = overview?.dataset;
  const datasetStatus = datasetStatusMeta(dataset?.status);
  const datasetStatusKey = String(dataset?.status || '').toUpperCase();
  const datasetRunnable =
    !!dataset?.versionNo &&
    (!datasetStatusKey ||
      ['FROZEN', 'PUBLISHED', 'ACTIVE'].includes(datasetStatusKey));
  const lastRun = overview?.lastRun;
  const availability = availabilityMeta(lastRun);
  const badcases = overview?.badcaseCounts;
  const coreMetrics =
    runDetail?.metrics?.filter(
      (item) => String(item.metricLayer || '').toUpperCase() === 'CORE',
    ) || [];

  return (
    <div>
      <div className="grid grid-4 mb-16">
        <div className="stat blue">
          <div className="label">QA 集合版本</div>
          <div className="value tnum" style={{ fontSize: 19 }}>
            <span className="mono">{dataset?.versionNo || '未配置'}</span>
          </div>
          <div className="foot">
            <StatusTag meta={datasetStatus} />
            <span>{dataset?.caseCount != null ? `${dataset.caseCount} 题` : '题数未知'}</span>
          </div>
          <div className="s-icon">
            <Icon name="list" size={15} />
          </div>
        </div>
        <div className="stat">
          <div className="label">最近跑批</div>
          <div className="value tnum" style={{ fontSize: 18 }}>
            <span className="mono">{lastRun?.runId || '未跑批'}</span>
          </div>
          <div className="foot">
            <StatusTag meta={availability} />
            <span>{fmtTime(lastRun?.finishedAt)}</span>
          </div>
          <div className="s-icon">
            <Icon name="play" size={15} />
          </div>
        </div>
        <div className="stat violet">
          <div className="label">核心达标</div>
          <div className="value tnum">
            {lastRun
              ? `${lastRun.corePassCount ?? '—'} / ${lastRun.coreTotal ?? '—'}`
              : '—'}
          </div>
          <div className="foot">结果可用只表示测量有效</div>
          <div className="s-icon">
            <Icon name="target" size={15} />
          </div>
        </div>
        <div className="stat amber">
          <div className="label">待修坏例</div>
          <div className="value tnum">{badcases?.open ?? '—'}</div>
          <div className="foot">
            已修复 {badcases?.fixed ?? '—'} · 回归{' '}
            {badcases?.regressed ?? '—'}
          </div>
          <div className="s-icon">
            <Icon name="alert-triangle" size={15} />
          </div>
        </div>
      </div>

      <div className="eval-result-layout">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="target" size={14} />
                本次结果
                <span className="hint">最近一次跑批的核心摘要</span>
              </h3>
              <div className="actions">
                {lastRun?.runId ? (
                  <button className="btn xs primary-soft" type="button" onClick={onOpenResult}>
                    进入本次结果
                    <Icon name="arrow-right" size={10} />
                  </button>
                ) : (
                  <button className="btn xs primary" type="button" onClick={onCreateRun}>
                    <Icon name="play" size={11} />
                    发起跑批
                  </button>
                )}
              </div>
            </div>
            <div className="panel-body">
              {lastRun?.runId ? (
                <>
                  <div className="eval-context" style={{ marginBottom: 12 }}>
                    <div className="ec-left">
                      <b className="mono">{lastRun.runId}</b>
                      <StatusTag meta={availability} />
                      <span>{fmtTime(lastRun.finishedAt)}</span>
                      <span>{fmtDuration(lastRun.durationMs)}</span>
                    </div>
                  </div>
                  {coreMetrics.length ? (
                    <div className="grid grid-3" style={{ gap: 10 }}>
                      {coreMetrics.map((metric) => (
                        <div className="logic-cell" key={metric.metricCode}>
                          <label>
                            {metric.metricName || metric.metricCode}{' '}
                            <StatusTag meta={metricStatusMeta(metric.status)} />
                          </label>
                          <b>{fmtMetricValue(metric.value, metric.unit)}</b>
                          <small className="note" style={{ display: 'block', marginTop: 2 }}>
                            目标 {fmtMetricValue(metric.targetValue, metric.unit)}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="note">
                      当前未加载核心指标明细；进入本次结果或指标总览查看。
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon="play"
                  title="尚无跑批结果"
                  description="维护并发布 QA 集合后发起第一次跑批；页面只呈现真实返回。"
                  action={
                    <div className="row gap-6">
                      <button className="btn primary" type="button" onClick={onCreateRun}>
                        发起跑批
                      </button>
                      <button className="btn" type="button" onClick={onEditDataset}>
                        编辑 QA 集合
                      </button>
                    </div>
                  }
                />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="shield-check" size={14} />
                测量证据
                <span className="hint">版本 / 覆盖 / 评分 / 逐题 / 复现</span>
              </h3>
              <div className="actions">
                <button
                  className="btn xs"
                  type="button"
                  onClick={onOpenTrust}
                  disabled={!lastRun?.runId}
                >
                  凭什么可用
                </button>
              </div>
            </div>
            <div className="panel-body">
              <EvidenceList items={overview?.evidence} />
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="list" size={14} />
                QA 集合
              </h3>
              <div className="actions">
                <button className="btn xs" type="button" onClick={onEditDataset}>
                  <Icon name="edit" size={11} />
                  管理
                </button>
              </div>
            </div>
            <div className="panel-body">
              <dl className="kv eval-version-kv">
                <dt>版本</dt>
                <dd className="mono">{dataset?.versionNo || '未配置'}</dd>
                <dt>状态</dt>
                <dd>
                  <StatusTag meta={datasetStatus} />
                </dd>
                <dt>题数</dt>
                <dd>{dataset?.caseCount ?? '—'}</dd>
                <dt>发布时间</dt>
                <dd>{fmtTime(dataset?.publishedAt)}</dd>
                <dt>跑批可用</dt>
                <dd>
                  {datasetRunnable ? (
                    <Tag tone="green" className="sm">
                      已冻结版本可发起
                    </Tag>
                  ) : dataset?.versionNo ? (
                    <Tag tone="amber" className="sm">
                      需先发布冻结
                    </Tag>
                  ) : (
                    <Tag tone="amber" className="sm">
                      需先发布
                    </Tag>
                  )}
                </dd>
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="alert-triangle" size={14} />
                坏例
              </h3>
              <div className="actions">
                <button className="btn xs ghost" type="button" onClick={onOpenCases}>
                  查看台账
                  <Icon name="arrow-right" size={10} />
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="grid grid-3" style={{ gap: 8 }}>
                {[
                  ['待修复', badcases?.open ?? '—'],
                  ['已修复', badcases?.fixed ?? '—'],
                  ['回归', badcases?.regressed ?? '—'],
                ].map(([label, value]) => (
                  <div className="logic-cell" key={String(label)}>
                    <label>{label}</label>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="info" size={14} />
                未接入边界
              </h3>
            </div>
            <div className="panel-body">
              <NotConnectedList items={overview?.notConnected} />
              <div className="callout mt-16" style={{ marginBottom: 0 }}>
                <Icon name="shield" size={15} />
                <div className="ct">
                  <b>本地规则判分（未校准）</b>
                  <p>仅代表当前快照与配置下的相对参考，不是生产评测结论。</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
