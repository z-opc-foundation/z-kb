import Icon from '@/components/icon';
import {
  queryEvalOverview,
  queryEvalRun,
  type EvalCreateRunResult,
  type EvalOverview,
  type EvalRunDetail,
  type EvalRunRecord,
} from '@/services/evaluation';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CasesView from './components/cases-view';
import MetricsView from './components/metrics-view';
import OverviewView from './components/overview-view';
import QaDatasetDrawer from './components/qa-dataset-drawer';
import ResultView from './components/result-view';
import RunCreateModal from './components/run-create-modal';
import RunsView from './components/runs-view';
import StagesView from './components/stages-view';
import TrustDrawer from './components/trust-drawer';
import {
  mergeRunRecords,
  readKnownRuns,
  writeKnownRuns,
} from './components/run-cache';
import {
  availabilityMeta,
  ErrorState,
  fmtTime,
  runRecordFromBrief,
  runStatusMeta,
  StatusTag,
} from './components/shared';
import './index.less';

const VIEW_KEYS = [
  'overview',
  'result',
  'metrics',
  'stages',
  'cases',
  'runs',
] as const;
type ViewKey = (typeof VIEW_KEYS)[number];

const VIEW_META: Record<ViewKey, { label: string; icon: string }> = {
  overview: { label: '概览', icon: 'info' },
  result: { label: '本次结果', icon: 'target' },
  metrics: { label: '指标总览', icon: 'bar-chart' },
  stages: { label: '阶段诊断', icon: 'workflow' },
  cases: { label: '坏例与回归', icon: 'alert-triangle' },
  runs: { label: '测评跑批', icon: 'play' },
};

function parseView(value: string | null): ViewKey {
  return VIEW_KEYS.includes((value || '') as ViewKey)
    ? ((value || '') as ViewKey)
    : 'result';
}

export default function EvaluationWorkbenchPage() {
  const params = useParams<{ kbId?: string }>();
  const kbId = params.kbId || '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = parseView(searchParams.get('view'));
  const urlRunId = searchParams.get('runId') || '';
  const baselineRunId = searchParams.get('baselineRunId') || '';
  const layer = searchParams.get('layer') || '';
  const stageCode = searchParams.get('stage') || '';
  const statusFilter = searchParams.get('status') || '';
  const caseId = searchParams.get('caseId') || '';
  const trustOpen = ['1', 'true'].includes(
    (searchParams.get('trust') || '').toLowerCase(),
  );

  const [overview, setOverview] = useState<EvalOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [overviewTick, setOverviewTick] = useState(0);

  const [runDetail, setRunDetail] = useState<EvalRunDetail | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState(false);
  const [runTick, setRunTick] = useState(0);

  const [knownRuns, setKnownRuns] = useState<EvalRunRecord[]>(() =>
    readKnownRuns(kbId),
  );
  const [reused, setReused] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const lastRunId = overview?.lastRun?.runId || '';
  const effectiveRunId = urlRunId || lastRunId;

  const updateParams = useCallback(
    (
      patch: Record<string, string | null>,
      options?: { replace?: boolean },
    ) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value) {
              next.set(key, value);
            } else {
              next.delete(key);
            }
          });
          return next;
        },
        { replace: options?.replace !== false },
      );
    },
    [setSearchParams],
  );

  const rememberRun = useCallback(
    (record: EvalRunRecord) => {
      if (!kbId || !record?.runId) {
        return;
      }
      const merged = mergeRunRecords(readKnownRuns(kbId), [record]);
      writeKnownRuns(kbId, merged);
      setKnownRuns(merged);
    },
    [kbId],
  );

  useEffect(() => {
    setKnownRuns(readKnownRuns(kbId));
  }, [kbId]);

  useEffect(() => {
    if (!kbId) {
      setOverview(null);
      setOverviewLoading(false);
      setOverviewError(true);
      return;
    }
    let alive = true;
    setOverviewLoading(true);
    setOverviewError(false);
    queryEvalOverview(kbId, baselineRunId || undefined).then((result) => {
      if (!alive) {
        return;
      }
      setOverviewLoading(false);
      if (result === undefined) {
        setOverviewError(true);
        return;
      }
      setOverview(result);
      if (result.lastRun?.runId) {
        rememberRun(runRecordFromBrief(result.lastRun, kbId));
      }
    });
    return () => {
      alive = false;
    };
  }, [baselineRunId, kbId, overviewTick, rememberRun]);

  useEffect(() => {
    if (!kbId || urlRunId || !lastRunId) {
      return;
    }
    // 首次进入时把最近跑批写入 URL，刷新 / 分享后仍指向同一次结果。
    updateParams({ runId: lastRunId }, { replace: true });
  }, [kbId, lastRunId, updateParams, urlRunId]);

  useEffect(() => {
    if (!effectiveRunId) {
      setRunDetail(null);
      setRunLoading(false);
      setRunError(false);
      return;
    }
    let alive = true;
    setRunLoading(true);
    setRunError(false);
    setRunDetail(null);
    queryEvalRun(effectiveRunId).then((result) => {
      if (!alive) {
        return;
      }
      setRunLoading(false);
      if (result === undefined) {
        setRunError(true);
        return;
      }
      setRunDetail(result);
      rememberRun(result.run);
    });
    return () => {
      alive = false;
    };
  }, [effectiveRunId, rememberRun, runTick]);

  const switchView = (nextView: ViewKey) => {
    updateParams({
      view: nextView,
      ...(nextView === 'cases' ? {} : { caseId: null }),
    });
  };

  const openRun = (runId: string) => {
    if (!runId) {
      return;
    }
    setReused(false);
    updateParams({ view: 'result', runId, caseId: null }, { replace: false });
  };

  const openStage = (nextStage: string) => {
    updateParams({
      view: 'stages',
      stage: nextStage || null,
    });
  };

  const openCase = (nextCaseId: string) => {
    updateParams({
      view: 'cases',
      caseId: nextCaseId || null,
      status: null,
    });
  };

  const setBaseline = (runId?: string) => {
    updateParams({ baselineRunId: runId || null });
  };

  const openTrust = () => updateParams({ trust: '1' });
  const closeTrust = () => updateParams({ trust: null });

  const retryAll = () => {
    setOverviewTick((value) => value + 1);
    setRunTick((value) => value + 1);
  };

  const handleCreated = (result: EvalCreateRunResult) => {
    const record: EvalRunRecord = {
      runId: result.runId,
      kbId,
      status: result.status ?? null,
      resultUsable: result.resultUsable ?? null,
      unusableReason: result.unusableReason ?? null,
      datasetVersionNo: result.datasetVersionNo ?? null,
      snapshotId: result.snapshotId ?? null,
      configVersion: result.configVersion ?? null,
      judgeVersion: result.judgeVersion ?? null,
      indexGeneration: result.indexGeneration ?? null,
      caseTotal: result.caseTotal ?? null,
      caseDone: result.caseDone ?? null,
      finishedAt: result.finishedAt ?? null,
      durationMs: result.durationMs ?? null,
      startedAt: result.finishedAt ?? null,
    };
    rememberRun(record);
    setReused(!!result.reused);
    setCreateOpen(false);
    setOverviewTick((value) => value + 1);
    setRunTick((value) => value + 1);
    updateParams({ view: 'result', runId: result.runId }, { replace: false });
  };

  if (!kbId) {
    return (
      <div className="view">
        <section className="panel">
          <ErrorState
            title="缺少知识库标识"
            description="深链需要 /knowledge-bases/:kbId/evaluation。"
            action={
              <button
                className="btn"
                type="button"
                onClick={() => navigate('/evaluations')}
              >
                返回评测库
              </button>
            }
          />
        </section>
      </div>
    );
  }

  const currentRun = runDetail?.run;
  const lastRunBrief = overview?.lastRun;
  const availability = availabilityMeta(
    currentRun ||
      (lastRunBrief?.runId
        ? {
            runId: lastRunBrief.runId,
            status: lastRunBrief.status,
            resultUsable: lastRunBrief.resultUsable,
          }
        : null),
  );
  const runStatus = runStatusMeta(
    currentRun?.status || lastRunBrief?.status || null,
  );
  const qaVersion =
    currentRun?.datasetVersionNo || overview?.dataset?.versionNo || '';
  const configVersion =
    currentRun?.configVersion || currentRun?.taskConfigVersion || '';
  const snapshotId = currentRun?.snapshotId || '';
  const indexGeneration = currentRun?.indexGeneration;
  const kbName = overview?.kbName || '知识评测';
  const overviewBusy = overviewLoading && !overview;
  const runBusy = !!effectiveRunId && runLoading && !runDetail;
  const resultLoading = overviewBusy || runBusy;
  const resultError = overviewError || runError;

  const renderContent = () => {
    switch (view) {
      case 'overview':
        return (
          <OverviewView
            overview={overview}
            runDetail={runDetail}
            loading={overviewBusy}
            error={overviewError}
            onRetry={retryAll}
            onCreateRun={() => setCreateOpen(true)}
            onEditDataset={() => setQaOpen(true)}
            onOpenResult={() => {
              if (lastRunBrief?.runId) {
                openRun(lastRunBrief.runId);
              } else {
                switchView('result');
              }
            }}
            onOpenCases={() => switchView('cases')}
            onOpenTrust={openTrust}
          />
        );
      case 'result':
        return (
          <ResultView
            overview={overview}
            runDetail={runDetail}
            loading={resultLoading}
            error={resultError}
            reused={reused}
            onRetry={retryAll}
            onCreateRun={() => setCreateOpen(true)}
            onEditDataset={() => setQaOpen(true)}
            onOpenTrust={openTrust}
            onOpenCases={() => switchView('cases')}
            onOpenMetrics={() => switchView('metrics')}
            onOpenStage={openStage}
          />
        );
      case 'metrics':
        return (
          <MetricsView
            runDetail={runDetail}
            loading={resultLoading}
            error={resultError}
            layer={layer}
            onLayerChange={(nextLayer) =>
              updateParams({ layer: nextLayer || null })
            }
            onRetry={retryAll}
            onCreateRun={() => setCreateOpen(true)}
          />
        );
      case 'stages':
        return (
          <StagesView
            kbId={kbId}
            runDetail={runDetail}
            loading={resultLoading}
            error={resultError}
            stageCode={stageCode}
            onStageChange={(nextStage) =>
              updateParams({ stage: nextStage || null })
            }
            onOpenCase={openCase}
            onCreateRun={() => setCreateOpen(true)}
            onRetry={retryAll}
          />
        );
      case 'cases':
        return (
          <CasesView
            kbId={kbId}
            runDetail={runDetail}
            overview={overview}
            statusFilter={statusFilter}
            caseId={caseId}
            onStatusChange={(nextStatus) =>
              updateParams({ status: nextStatus || null })
            }
            onOpenCase={openCase}
            onCloseCase={() => updateParams({ caseId: null })}
            onBadcaseUpdated={retryAll}
            onCreateRun={() => setCreateOpen(true)}
          />
        );
      case 'runs':
        return (
          <RunsView
            overview={overview}
            runs={knownRuns}
            currentRunId={effectiveRunId}
            baselineRunId={baselineRunId}
            onOpenRun={openRun}
            onSetBaseline={setBaseline}
            onCreateRun={() => setCreateOpen(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="view eval-detail-page">
      <section className="kb-hero eval-kb-hero">
        <div className="kb-hero-main">
          <div className="kb-icon">
            <Icon name="shield-check" size={22} />
          </div>
          <div className="kb-hero-copy">
            <h1>
              {kbName}
              <span className="tag gray sm">知识评测</span>
            </h1>
            <div className="meta">
              <span className="tag amber">本地规则判分（未校准）</span>
              <StatusTag meta={availability} />
              {currentRun || lastRunBrief ? (
                <StatusTag meta={runStatus} />
              ) : null}
              <span className="tag gray mono">{kbId}</span>
            </div>
            <p className="desc">
              单库评测工作台：固定 QA 版本、配置与快照后按本地规则判分，结果只代表当前快照下的相对参考。
            </p>
            <div className="eval-hero-run">
              {currentRun?.runId || lastRunBrief?.runId ? (
                <>
                  <span>
                    当前跑批{' '}
                    <b className="mono">
                      {currentRun?.runId || lastRunBrief?.runId}
                    </b>
                  </span>
                  <span>
                    完成于 <b>{fmtTime(currentRun?.finishedAt || lastRunBrief?.finishedAt)}</b>
                  </span>
                </>
              ) : (
                <span>尚未发起跑批</span>
              )}
            </div>
          </div>
          <div className="eval-hero-side">
            <div className="eval-gate-note">
              <Icon name="info" size={12} />
              知识评测只做相对参考，不是发布门禁
            </div>
            <div className="kb-hero-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setQaOpen(true)}
              >
                <Icon name="edit" size={14} />
                编辑 QA 集合
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                <Icon name="play" size={14} />
                发起跑批
              </button>
              <button
                className="btn primary-soft"
                type="button"
                onClick={openTrust}
              >
                <Icon name="shield-check" size={14} />
                凭什么可用
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  navigate(`/knowledge-bases/${encodeURIComponent(kbId)}`)
                }
              >
                <Icon name="arrow-left" size={14} />
                返回知识库
              </button>
            </div>
          </div>
        </div>
        <div className="kb-facts">
          <div className="kb-fact">
            <Icon name="list" size={13} />
            QA 版本 <b className="mono">{qaVersion || '未配置'}</b>
          </div>
          <span className="sep"></span>
          <div className="kb-fact">
            <Icon name="settings" size={13} />
            配置版本 <b className="mono">{configVersion || '—'}</b>
          </div>
          <span className="sep"></span>
          <div className="kb-fact">
            <Icon name="layers" size={13} />
            snapshotId{' '}
            <b className="mono ellipsis" title={snapshotId || ''}>
              {snapshotId || '—'}
            </b>
          </div>
          <span className="sep"></span>
          <div className="kb-fact">
            <Icon name="refresh" size={13} />
            索引代际 <b className="mono">{indexGeneration ?? '—'}</b>
          </div>
          <span className="sep"></span>
          <div className="kb-fact">
            <Icon name="play" size={13} />
            跑批 <b className="mono">{effectiveRunId || '未跑批'}</b>
          </div>
        </div>
      </section>

      <nav className="kb-tabs eval-kb-tabs">
        {VIEW_KEYS.filter((key) => key !== 'overview').map((key) => {
          const meta = VIEW_META[key];
          return (
            <button
              key={key}
              type="button"
              className={`kb-tab ${view === key ? 'active' : ''}`}
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onClick={() => switchView(key)}
            >
              <Icon name={meta.icon} size={14} />
              {meta.label}
              {key === 'cases' && overview?.badcaseCounts?.open != null ? (
                <span className="count">{overview.badcaseCounts.open}</span>
              ) : null}
              {key === 'runs' && knownRuns.length ? (
                <span className="count">{knownRuns.length}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {overviewError ? (
        <div className="callout warn mb-16">
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>评测概览刷新失败</b>
            <p>
              库级字段（QA 版本、最近跑批、坏例计数）可能缺失；当前展示不会用本地样本补齐。
            </p>
          </div>
          <button className="btn xs" type="button" onClick={retryAll}>
            <Icon name="refresh" size={11} />
            重试
          </button>
        </div>
      ) : null}

      {overviewError && !overview && view === 'runs' ? (
        <div className="callout mb-16">
          <Icon name="alert-circle" size={15} />
          <div className="ct">
            <b>库级概览暂不可用</b>
            <p>
              跑批记录仍按本会话真实查询到的 runId 展示；不会虚构历史记录。
            </p>
          </div>
        </div>
      ) : null}

      <div className="eval-view-body">{renderContent()}</div>

      {qaOpen ? (
        <QaDatasetDrawer
          kbId={kbId}
          kbName={kbName}
          onClose={() => setQaOpen(false)}
          onChanged={() => {
            setOverviewTick((value) => value + 1);
            setRunTick((value) => value + 1);
          }}
        />
      ) : null}

      {createOpen ? (
        <RunCreateModal
          kbId={kbId}
          overview={overview}
          knownRuns={knownRuns}
          defaultBaselineRunId={baselineRunId || undefined}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}

      {trustOpen ? (
        <TrustDrawer
          runId={effectiveRunId || undefined}
          onClose={closeTrust}
        />
      ) : null}
    </div>
  );
}
