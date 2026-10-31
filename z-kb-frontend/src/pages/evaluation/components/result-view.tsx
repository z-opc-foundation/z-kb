import Icon from '@/components/icon';
import type {
  EvalMetricRecord,
  EvalOverview,
  EvalRunBaseline,
  EvalRunDetail,
} from '@/services/evaluation';
import {
  availabilityMeta,
  baselineMetricMap,
  collectMetrics,
  deltaMeta,
  EmptyState,
  ErrorState,
  EvidenceList,
  fmtDuration,
  fmtMetricValue,
  fmtTime,
  layerMeta,
  LoadingState,
  metricsByLayer,
  metricStatusMeta,
  NotConnectedList,
  runStatusMeta,
  StageFlow,
  StatusTag,
  Tag,
  totalBadcases,
} from './shared';

interface ResultViewProps {
  overview?: EvalOverview | null;
  runDetail?: EvalRunDetail | null;
  loading: boolean;
  error: boolean;
  reused?: boolean;
  onRetry: () => void;
  onCreateRun: () => void;
  onEditDataset: () => void;
  onOpenTrust: () => void;
  onOpenCases: () => void;
  onOpenMetrics: () => void;
  onOpenStage: (stageCode: string) => void;
}

function runtimeStatClass(index: number): string {
  return ['', 'green', 'violet', 'amber'][index % 4];
}

export default function ResultView({
  overview,
  runDetail,
  loading,
  error,
  reused,
  onRetry,
  onCreateRun,
  onEditDataset,
  onOpenTrust,
  onOpenCases,
  onOpenMetrics,
  onOpenStage,
}: ResultViewProps) {
  if (loading) {
    return (
      <section className="panel">
        <LoadingState title="正在加载跑批结果…" />
      </section>
    );
  }

  if (!runDetail) {
    if (error) {
      return (
        <section className="panel">
          <ErrorState
            title="跑批明细加载失败"
            description="queryRun 返回异常或该 runId 不存在。刷新可重试，不会用本地数据补齐指标。"
            onRetry={onRetry}
          />
        </section>
      );
    }
    return (
      <section className="panel">
        <EmptyState
          icon="play"
          title="尚未发起跑批"
          description="当前知识库还没有可展示的跑批结果。发布 QA 集合后发起一次跑批，页面只呈现后端真实返回的指标。"
          action={
            <div className="row gap-6">
              <button className="btn primary" type="button" onClick={onCreateRun}>
                <Icon name="play" size={13} />
                发起跑批
              </button>
              <button className="btn" type="button" onClick={onEditDataset}>
                <Icon name="edit" size={13} />
                编辑 QA 集合
              </button>
            </div>
          }
          extra={
            <div className="eval-empty-meta">
              <span>
                QA{' '}
                <b className="mono">
                  {overview?.dataset?.versionNo || '未配置'}
                </b>
              </span>
              <span>
                题数 <b>{overview?.dataset?.caseCount ?? '—'}</b>
              </span>
              <span>
                数据集状态 <b>{overview?.dataset?.status || '未配置'}</b>
              </span>
            </div>
          }
        />
      </section>
    );
  }

  const { run } = runDetail;
  const metrics = collectMetrics(runDetail);
  const coreMetrics = metricsByLayer(metrics, 'CORE');
  const preMetrics = metricsByLayer(metrics, 'PRECONDITION');
  const runtimeMetrics = metricsByLayer(metrics, 'RUNTIME');
  const baseline = baselineMetricMap(runDetail.baseline);
  const comparable = runDetail.comparable === true;
  const availability = availabilityMeta(run);
  const status = runStatusMeta(run.status);
  const badcases = runDetail.badcaseCounts || overview?.badcaseCounts;
  const baselineRun: EvalRunBaseline | null = runDetail.baseline || null;
  const summaryPass = `${run.caseDone ?? '—'} / ${run.caseTotal ?? '—'}`;
  const lastRunBrief =
    overview?.lastRun?.runId === run.runId ? overview.lastRun : null;
  const hasCoreStatus = coreMetrics.some((metric) =>
    String(metric.status || '').trim(),
  );
  const greenCoreCount = coreMetrics.filter(
    (metric) => metricStatusMeta(metric.status).tone === 'green',
  ).length;
  const corePassCount: number | string =
    lastRunBrief?.corePassCount ?? (hasCoreStatus ? greenCoreCount : '—');
  const coreTotal = lastRunBrief?.coreTotal ?? coreMetrics.length;

  return (
    <div>
      {reused ? (
        <div className="alert-banner target">
          <Icon name="refresh" size={15} />
          <div className="txt">
            <b>已复用两小时内同口径跑批</b>
            <span> createRun 返回 reused=true，本次直接读取已有结果。</span>
          </div>
        </div>
      ) : null}

      <div className="eval-context">
        <div className="ec-left">
          <b className="mono">{run.runId}</b>
          <StatusTag meta={status} />
          <StatusTag meta={availability} />
          <span>
            完成于 <b>{fmtTime(run.finishedAt)}</b>
          </span>
          <span>
            耗时 <b>{fmtDuration(run.durationMs)}</b>
          </span>
          <span>
            逐题 <b>{summaryPass}</b>
          </span>
          {run.retrievalTruncated ? (
            <Tag tone="amber" className="sm">
              检索截断
            </Tag>
          ) : null}
        </div>
        <div className="ec-right">
          <button className="btn xs" type="button" onClick={onOpenMetrics}>
            <Icon name="bar-chart" size={11} />
            全部指标
          </button>
          <button className="btn xs" type="button" onClick={onOpenCases}>
            <Icon name="alert-triangle" size={11} />
            坏例与回归
          </button>
          <button className="btn xs primary-soft" type="button" onClick={onOpenTrust}>
            <Icon name="shield-check" size={11} />
            凭什么可用
          </button>
        </div>
      </div>

      {run.resultUsable === false ? (
        <div className="callout warn mb-16">
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>本次结果标记为不可用</b>
            <p>
              {run.unusableReason ||
                '前置条件未满足，只表示测量有效性不足；不会阻断任何流程，也不会生成发布门禁结论。'}
            </p>
          </div>
        </div>
      ) : null}

      {baselineRun && !comparable ? (
        <div className="callout mb-16">
          <Icon name="git-compare" size={15} />
          <div className="ct">
            <b>本次与基线不可直接比较</b>
            <p>
              数据集 / 配置 / Judge / 覆盖范围不同，页面不计算 Δ，只并列展示本次与基线值。
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-4 mb-16">
        {runtimeMetrics.length
          ? runtimeMetrics.map((metric, index) => {
              const baselineValue = baseline.get(metric.metricCode)?.value;
              const delta = comparable
                ? deltaMeta(metric.value, baselineValue, metric.unit)
                : null;
              return (
                <div
                  className={`stat ${runtimeStatClass(index)}`}
                  key={`${metric.stageCode || ''}-${metric.metricCode}`}
                >
                  <div className="label">
                    {metric.metricName || metric.metricCode}
                  </div>
                  <div className="value tnum">
                    {fmtMetricValue(metric.value, metric.unit)}
                  </div>
                  <div className="foot">
                    <StatusTag meta={metricStatusMeta(metric.status)} />
                    <span>
                      目标 {fmtMetricValue(metric.targetValue, metric.unit)}
                    </span>
                    {baselineRun ? (
                      <span>
                        基线 {fmtMetricValue(baselineValue, metric.unit)}
                      </span>
                    ) : null}
                    {delta ? <span>Δ {delta.text}</span> : null}
                  </div>
                  <div className="s-icon">
                    <Icon name="activity" size={15} />
                  </div>
                </div>
              );
            })
          : [
              {
                label: '本次结果',
                value: availability.label,
                foot: runRunTitle(run.runId, run.status),
                icon: 'check-circle',
                tone: availability.tone === 'green' ? 'green' : 'amber',
              },
              {
                label: '核心结果',
                value: `${corePassCount} / ${coreTotal}`,
                foot: '核心 6 项分开看',
                icon: 'target',
                tone: 'violet',
              },
              {
                label: '前置条件',
                value: String(preMetrics.length || '—'),
                foot: '不达标只标记结果不可用',
                icon: 'layers',
                tone: '',
              },
              {
                label: '开放坏例',
                value: String(badcases?.open ?? '—'),
                foot: `已修复 ${badcases?.fixed ?? '—'} · 回归 ${badcases?.regressed ?? '—'}`,
                icon: 'alert-triangle',
                tone: 'amber',
              },
            ].map((item) => (
              <div className={`stat ${item.tone}`} key={item.label}>
                <div className="label">{item.label}</div>
                <div className="value tnum">{item.value}</div>
                <div className="foot">
                  <span>{item.foot}</span>
                </div>
                <div className="s-icon">
                  <Icon name={item.icon} size={15} />
                </div>
              </div>
            ))}
      </div>

      <div className="eval-result-layout">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="target" size={14} />
                核心结果
                <span className="hint">
                  {coreMetrics.length
                    ? `${coreMetrics.length} 项 · 本次 ${corePassCount} / ${coreTotal} 达标`
                    : '未返回核心指标'}
                </span>
              </h3>
              <div className="actions">
                <button className="btn xs ghost" type="button" onClick={onOpenMetrics}>
                  全部指标
                  <Icon name="arrow-right" size={10} />
                </button>
              </div>
            </div>
            <div className="panel-body">
              {coreMetrics.length ? (
                <div className="eval-core-grid">
                  {coreMetrics.map((metric) => (
                    <CoreMetricCard
                      key={`${metric.stageCode || ''}-${metric.metricCode}`}
                      metric={metric}
                      baseline={baseline.get(metric.metricCode)?.value}
                      comparable={comparable}
                      hasBaseline={!!baselineRun}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="本次跑批未返回核心指标"
                  description="本次跑批没有返回核心指标。"
                  icon="target"
                />
              )}
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>结果可用不等于全部达标</b>
                  <p>
                    核心指标两两配对阅读；低于目标只会进入待修坏例，不生成通过 / 阻断结论。
                  </p>
                </div>
              </div>
            </div>
            <div className="panel-foot">
              <span className="mono">{run.runId}</span>
              <span>
                本地规则判分（未校准）
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="layers" size={14} />
                前置条件
                <span className="hint">
                  {preMetrics.length} 项 · 不达标只标记结果不可用
                </span>
              </h3>
            </div>
            <div className="panel-body">
              {preMetrics.length ? (
                <div className="grid grid-3" style={{ gap: 10 }}>
                  {preMetrics.map((metric) => {
                    const meta = metricStatusMeta(metric.status);
                    const delta = comparable
                      ? deltaMeta(
                          metric.value,
                          baseline.get(metric.metricCode)?.value,
                          metric.unit,
                        )
                      : null;
                    return (
                      <div
                        className="logic-cell"
                        key={`${metric.stageCode || ''}-${metric.metricCode}`}
                      >
                        <label>
                          {metric.metricName || metric.metricCode}{' '}
                          <StatusTag meta={meta} />
                        </label>
                        <b className={meta.tone === 'green' ? 'c-green' : 'c-amber'}>
                          {fmtMetricValue(metric.value, metric.unit)}
                        </b>
                        <small className="note" style={{ display: 'block', marginTop: 2 }}>
                          目标 {fmtMetricValue(metric.targetValue, metric.unit)}
                          {baselineRun
                            ? ` · 基线 ${fmtMetricValue(
                                baseline.get(metric.metricCode)?.value,
                                metric.unit,
                              )}`
                            : ''}
                          {delta ? ` · Δ ${delta.text}` : ''}
                        </small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="本次跑批未返回前置条件"
                  description="前置条件缺失时，结果可用性以接口返回为准。"
                  icon="layers"
                />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="workflow" size={14} />
                阶段诊断
                <span className="hint">
                  {runDetail.stages?.length || 0} 段 · 点击进入逐段查看
                </span>
              </h3>
              <div className="actions">
                <button
                  className="btn xs ghost"
                  type="button"
                  onClick={() => onOpenStage(runDetail.stages?.[0]?.stageCode || '')}
                >
                  逐段查看
                  <Icon name="arrow-right" size={10} />
                </button>
              </div>
            </div>
            <div className="panel-body">
              <StageFlow
                stages={runDetail.stages || []}
                onSelect={(stageCode) => onOpenStage(stageCode)}
              />
              <p className="note" style={{ marginTop: 10 }}>
                阶段用于定位问题，不做通过 / 阻断判断；单阶段跑批只更新本段诊断。
              </p>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="lock" size={14} />
                版本钉住
                <span className="hint">这次结论基于哪一版库</span>
              </h3>
            </div>
            <div className="panel-body">
              <dl className="kv eval-version-kv">
                <dt>数据集</dt>
                <dd className="mono">{run.datasetVersionNo || '—'}</dd>
                <dt>snapshotId</dt>
                <dd className="mono ellipsis" title={run.snapshotId || ''}>
                  {run.snapshotId || '—'}
                </dd>
                <dt>配置版本</dt>
                <dd className="mono">{run.configVersion || '—'}</dd>
                <dt>任务配置</dt>
                <dd className="mono">{run.taskConfigVersion || '—'}</dd>
                <dt>Judge</dt>
                <dd className="mono">
                  {[run.judgeMode, run.judgeVersion].filter(Boolean).join(' · ') || '—'}
                </dd>
                <dt>索引代际</dt>
                <dd className="mono">{run.indexGeneration ?? '—'}</dd>
                <dt>范围</dt>
                <dd>{run.scopeType || '—'}</dd>
                <dt>阶段</dt>
                <dd>{run.stageCode || '全链路'}</dd>
              </dl>
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>固定版本，不回写线上</b>
                  <p>
                    跑批固定数据集、配置与 Judge；线上状态变化不会回写本次结果。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="shield-check" size={14} />
                可用性证据
              </h3>
              <div className="actions">
                <button className="btn xs primary-soft" type="button" onClick={onOpenTrust}>
                  凭什么可用
                </button>
              </div>
            </div>
            <div className="panel-body">
              <EvidenceList items={runDetail.evidence || overview?.evidence} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="alert-triangle" size={14} />
                坏例入口
                <span className="hint">
                  {badcases?.open ?? '—'} 待修复 · {badcases?.fixed ?? '—'} 已修复 ·{' '}
                  {badcases?.regressed ?? '—'} 回归
                </span>
              </h3>
              <div className="actions">
                <button className="btn xs ghost" type="button" onClick={onOpenCases}>
                  查看全部
                  <Icon name="arrow-right" size={10} />
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="grid grid-3" style={{ gap: 8 }}>
                {[
                  ['待修复', badcases?.open ?? '—', 'amber'],
                  ['已修复', badcases?.fixed ?? '—', 'green'],
                  ['回归', badcases?.regressed ?? '—', 'red'],
                ].map(([label, value, tone]) => (
                  <div className="logic-cell" key={String(label)}>
                    <label>{label}</label>
                    <b className={`c-${tone}`}>{value}</b>
                  </div>
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                共 {badcases ? totalBadcases(badcases) : '—'} 条坏例；修复动作回业务页面，关闭前需按同一数据集回归。
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="info" size={14} />
                测评边界
              </h3>
            </div>
            <div className="panel-body">
              <NotConnectedList items={overview?.notConnected} />
              <div className="callout mt-16" style={{ marginBottom: 0 }}>
                <Icon name="shield" size={15} />
                <div className="ct">
                  <b>不自称生产评测结论</b>
                  <p>
                    本地规则判分（未校准），仅代表当前快照与配置下的相对参考；不设发布门禁。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function runRunTitle(runId: string, status?: string | null) {
  return `${runId} · ${runStatusMeta(status).label}`;
}

function CoreMetricCard({
  metric,
  baseline,
  comparable,
  hasBaseline,
}: {
  metric: EvalMetricRecord;
  baseline?: number | null;
  comparable: boolean;
  hasBaseline: boolean;
}) {
  const status = metricStatusMeta(metric.status);
  const delta = comparable
    ? deltaMeta(metric.value, baseline, metric.unit)
    : null;
  return (
    <div className={`eval-core-card ${status.tone === 'red' || status.tone === 'amber' ? 'warn' : ''}`}>
      <span className="ec-top">
        <span className="ec-name" title={metric.metricCode}>
          {metric.metricName || metric.metricCode}
        </span>
        <StatusTag meta={status} />
      </span>
      <span className="ec-value">
        {fmtMetricValue(metric.value, metric.unit)}
      </span>
      <span className="ec-target">
        目标 {fmtMetricValue(metric.targetValue, metric.unit)}
        {hasBaseline
          ? ` · 基线 ${fmtMetricValue(baseline, metric.unit)}`
          : ' · 未设置基线'}
      </span>
      <span className="ec-pair">
        {!hasBaseline
          ? '未设置基线，只展示本次'
          : comparable
            ? `Δ ${delta?.text || '—'} · 同口径可比`
            : '数据集 / 配置 / Judge / 范围不同，不计算 Δ'}
        {metric.attribution ? ` · ${metric.attribution}` : ''}
      </span>
      <span className="note">
        {layerMeta(metric.metricLayer).label}
        {metric.note ? ` · ${metric.note}` : ''}
      </span>
    </div>
  );
}
