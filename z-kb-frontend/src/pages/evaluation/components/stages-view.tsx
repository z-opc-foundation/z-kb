import Icon from '@/components/icon';
import {
  pageEvalCaseResults,
  type EvalCaseResultRecord,
  type EvalMetricRecord,
  type EvalRunDetail,
  type EvalStageRecord,
} from '@/services/evaluation';
import { useEffect, useState } from 'react';
import {
  behaviorMeta,
  EmptyState,
  ErrorState,
  fmtDuration,
  fmtMetricValue,
  layerMeta,
  LoadingState,
  metricStatusMeta,
  StageFlow,
  StatusTag,
} from './shared';

interface StagesViewProps {
  kbId: string;
  runDetail?: EvalRunDetail | null;
  loading: boolean;
  error: boolean;
  stageCode: string;
  onStageChange: (stageCode: string) => void;
  onOpenCase: (caseId: string) => void;
  onCreateRun: () => void;
  onRetry: () => void;
}

const CASE_PAGE_SIZE = 50;

export default function StagesView({
  runDetail,
  loading,
  error,
  stageCode,
  onStageChange,
  onOpenCase,
  onCreateRun,
  onRetry,
}: StagesViewProps) {
  const stages = runDetail?.stages || [];
  const selectedCode =
    stages.find((item) => item.stageCode === stageCode)?.stageCode ||
    stages[0]?.stageCode ||
    '';
  const selected = stages.find((item) => item.stageCode === selectedCode);
  const [cases, setCases] = useState<EvalCaseResultRecord[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesFailed, setCasesFailed] = useState(false);
  const [caseTick, setCaseTick] = useState(0);

  useEffect(() => {
    if (!runDetail || !selectedCode) {
      setCases([]);
      setCasesFailed(false);
      return;
    }
    let alive = true;
    setCasesLoading(true);
    setCasesFailed(false);
    pageEvalCaseResults({
      runId: runDetail.run.runId,
      current: 1,
      size: CASE_PAGE_SIZE,
      onlyBad: true,
      stageCode: selectedCode,
    }).then((result) => {
      if (!alive) {
        return;
      }
      setCasesLoading(false);
      if (result === undefined) {
        setCases([]);
        setCasesFailed(true);
        return;
      }
      setCases(Array.isArray(result) ? result : result.records || []);
    });
    return () => {
      alive = false;
    };
  }, [runDetail, selectedCode, caseTick]);

  if (loading) {
    return (
      <section className="panel">
        <LoadingState title="正在加载阶段诊断…" />
      </section>
    );
  }
  if (!runDetail) {
    if (error) {
      return (
        <section className="panel">
          <ErrorState
            title="阶段诊断加载失败"
            description="queryRun 未返回本次跑批的阶段数据。"
            onRetry={onRetry}
          />
        </section>
      );
    }
    return (
      <section className="panel">
        <EmptyState
          icon="workflow"
          title="尚未发起跑批"
          description="阶段诊断来自最近一次跑批；先发起跑批再查看。"
          action={
            <button className="btn primary" type="button" onClick={onCreateRun}>
              <Icon name="play" size={13} />
              发起跑批
            </button>
          }
        />
      </section>
    );
  }

  if (!stages.length) {
    return (
      <section className="panel">
        <EmptyState
          icon="workflow"
          title="本次跑批未返回阶段诊断"
          description="本次跑批没有返回阶段诊断。"
          action={
            <button className="btn" type="button" onClick={onRetry}>
              <Icon name="refresh" size={13} />
              重试
            </button>
          }
        />
      </section>
    );
  }

  const stageMetrics = stageMetricList(selected, runDetail.metrics || []);
  const metCount = stages.filter(
    (stage) => metricStatusMeta(stage.status).tone === 'green',
  ).length;

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="workflow" size={14} />
            RAG 全链路
            <span className="hint">
              {metCount} 段达标 · 共 {stages.length} 段 · 点击切换
            </span>
          </h3>
        </div>
        <div className="panel-body">
          <StageFlow stages={stages} active={selectedCode} onSelect={onStageChange} />
          <p className="note" style={{ marginTop: 10 }}>
            阶段用于定位问题，不做通过 / 阻断判断；单阶段跑批只更新本段诊断，不覆盖全链路结果。
          </p>
        </div>
      </section>

      <div className="eval-stage-layout mt-16">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="target" size={14} />
                {selected?.stageName || selected?.stageCode || '阶段'}
                <span className="hint">
                  {selected?.stageCode} · {stageMetrics.length} 项指标
                </span>
              </h3>
              <div className="actions">
                <StatusTag meta={metricStatusMeta(selected?.status)} />
              </div>
            </div>
            <div className="panel-body">
              {stageMetrics.length ? (
                <div className="grid grid-4" style={{ gap: 10 }}>
                  {stageMetrics.map((metric) => {
                    const status = metricStatusMeta(metric.status);
                    return (
                      <div
                        className="logic-cell"
                        key={`${metric.stageCode || selectedCode}-${metric.metricCode}`}
                      >
                        <label>
                          {metric.metricName || metric.metricCode}{' '}
                          <StatusTag meta={status} />
                        </label>
                        <b className={status.tone === 'green' ? 'c-green' : 'c-amber'}>
                          {fmtMetricValue(metric.value, metric.unit)}
                        </b>
                        <small
                          className="note"
                          style={{ display: 'block', marginTop: 2 }}
                        >
                          目标 {fmtMetricValue(metric.targetValue, metric.unit)} ·{' '}
                          {layerMeta(metric.metricLayer).label}
                        </small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="bar-chart"
                  title="该阶段未返回指标"
                  description="接口为空时不使用示例指标补齐。"
                />
              )}
            </div>
            <div className="panel-foot">
              <span className="mono">{runDetail.run.runId}</span>
              <span>
                {selected?.failingCaseCount != null
                  ? `${selected.failingCaseCount} 条失败坏例`
                  : '未返回失败坏例数'}
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="alert-triangle" size={14} />
                本阶段逐题坏例
                <span className="hint">
                  {casesLoading ? '加载中' : `${cases.length} 条`}
                </span>
              </h3>
              <div className="actions">
                <button
                  className="btn xs"
                  type="button"
                  onClick={() => setCaseTick((tick) => tick + 1)}
                >
                  <Icon name="refresh" size={11} />
                  刷新
                </button>
              </div>
            </div>
            <div className="table-wrap">
              {casesLoading ? (
                <LoadingState title="正在加载本阶段逐题结果…" />
              ) : casesFailed ? (
                <ErrorState
                  title="逐题坏例加载失败"
                  description="pageCaseResults 返回异常；不影响上方阶段指标展示。"
                  onRetry={() => setCaseTick((tick) => tick + 1)}
                />
              ) : cases.length ? (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>题号</th>
                      <th>问题</th>
                      <th>答案模式</th>
                      <th>坏例阶段</th>
                      <th>耗时</th>
                      <th>错误</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((item) => (
                      <tr key={item.caseId}>
                        <td className="mono-sm">{item.caseNo ?? '—'}</td>
                        <td>
                          <b>{item.question || '未返回问题'}</b>
                        </td>
                        <td>{item.answerMode ? behaviorMeta(item.answerMode).label : '—'}</td>
                        <td>
                          <div className="tag-list">
                            {(item.badcaseStages || []).length
                              ? (item.badcaseStages || []).map((stage) => (
                                  <span className="tag amber sm" key={stage}>
                                    {stage}
                                  </span>
                                ))
                              : '—'}
                          </div>
                        </td>
                        <td className="mono-sm">{fmtDuration(item.latencyMs)}</td>
                        <td>
                          <span className="note c-red">
                            {item.errorMessage || '—'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={() => onOpenCase(item.caseId)}
                          >
                            查看明细
                            <Icon name="chevron-right" size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  icon="check-circle"
                  title="本阶段没有逐题坏例"
                  description={
                    selected?.failingCaseCount
                      ? `后端声明 ${selected.failingCaseCount} 条失败坏例，但逐题接口未返回记录。`
                      : '本次跑批该阶段未返回失败题目。'
                  }
                />
              )}
            </div>
            <div className="panel-foot">
              <span>逐题明细绑定本次跑批与阶段 trace</span>
              <span className="mono">{selectedCode || '—'}</span>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="info" size={14} />
                阶段状态怎么读
              </h3>
            </div>
            <div className="panel-body">
              <div className="check-list">
                <div className="check-item">
                  <Icon name="check-circle" size={14} />
                  <div>
                    <b>达标</b>
                    <small>本段主指标达到目标；仍可能有其他分项需关注。</small>
                  </div>
                </div>
                <div className="check-item">
                  <Icon name="alert-triangle" size={14} />
                  <div>
                    <b>需关注</b>
                    <small>主指标低于目标，只进入待修坏例，不阻断流程。</small>
                  </div>
                </div>
                <div className="check-item">
                  <Icon name="arrow-right" size={14} />
                  <div>
                    <b>先修上游</b>
                    <small>召回低时先修索引与召回，不要先调生成。</small>
                  </div>
                </div>
                <div className="check-item">
                  <Icon name="play" size={14} />
                  <div>
                    <b>单阶段跑批</b>
                    <small>只更新本段诊断，不覆盖全链路结果。</small>
                  </div>
                </div>
              </div>
              <div className="callout mt-16" style={{ marginBottom: 0 }}>
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>本阶段结论不外推</b>
                  <p>
                    只看当前快照与配置下该阶段的相对表现，不代表线上全部流量。
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="layers" size={14} />
                阶段清单
              </h3>
            </div>
            <div className="panel-body tight">
              {stages.map((stage) => (
                <button
                  key={stage.stageCode}
                  type="button"
                  className="binding-row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: 0,
                    background:
                      stage.stageCode === selectedCode
                        ? 'var(--primary-soft)'
                        : undefined,
                  }}
                  onClick={() => onStageChange(stage.stageCode)}
                >
                  <span className="ic mono-sm">{stage.stageCode}</span>
                  <div className="copy">
                    <b>{stage.stageName || stage.stageCode}</b>
                    <small>
                      {stage.failingCaseCount != null
                        ? `${stage.failingCaseCount} 条坏例`
                        : '未返回坏例数'}
                    </small>
                  </div>
                  <StatusTag meta={metricStatusMeta(stage.status)} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function stageMetricList(
  stage: EvalStageRecord | undefined,
  runMetrics: EvalMetricRecord[],
): EvalMetricRecord[] {
  if (!stage) {
    return [];
  }
  if (stage.metrics?.length) {
    return stage.metrics;
  }
  return runMetrics.filter((metric) => metric.stageCode === stage.stageCode);
}
