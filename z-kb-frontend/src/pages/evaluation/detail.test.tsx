import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EvalDatasetDetail,
  EvalOverview,
  EvalRunDetail,
  EvalTrustEvidence,
} from '@/services/evaluation';
import {
  createEvalRun,
  listEvalBadcases,
  pageEvalCaseResults,
  publishEvalDataset,
  queryEvalDataset,
  queryEvalOverview,
  queryEvalRun,
  queryEvalTrustEvidence,
  saveEvalDatasetDraft,
  updateEvalBadcase,
} from '@/services/evaluation';
import { Route, Routes } from 'react-router-dom';
import { renderAt } from '@/test/render';
import EvaluationWorkbenchPage from './detail';

vi.mock('@/services/evaluation', () => ({
  pageEvaluationKnowledgeBases: vi.fn(),
  queryEvalOverview: vi.fn(),
  queryEvalDataset: vi.fn(),
  saveEvalDatasetDraft: vi.fn(),
  publishEvalDataset: vi.fn(),
  createEvalRun: vi.fn(),
  queryEvalRun: vi.fn(),
  pageEvalCaseResults: vi.fn(),
  listEvalBadcases: vi.fn(),
  queryEvalTrustEvidence: vi.fn(),
  updateEvalBadcase: vi.fn(),
}));

const overviewMock = vi.mocked(queryEvalOverview);
const runMock = vi.mocked(queryEvalRun);
const datasetMock = vi.mocked(queryEvalDataset);
const saveMock = vi.mocked(saveEvalDatasetDraft);
const publishMock = vi.mocked(publishEvalDataset);
const createMock = vi.mocked(createEvalRun);
const pageCasesMock = vi.mocked(pageEvalCaseResults);
const badcasesMock = vi.mocked(listEvalBadcases);
const trustMock = vi.mocked(queryEvalTrustEvidence);
const updateMock = vi.mocked(updateEvalBadcase);

const BASE_ROUTE = '/knowledge-bases/kb-1/evaluation';

const OVERVIEW: EvalOverview = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  dataset: {
    versionNo: 'v3',
    status: 'PUBLISHED',
    caseCount: 12,
    publishedAt: '2026-10-19T09:00:00',
  },
  lastRun: {
    runId: 'run-1',
    status: 'COMPLETED',
    resultUsable: true,
    finishedAt: '2026-10-20T10:00:00',
    durationMs: 65000,
    corePassCount: 5,
    coreTotal: 6,
  },
  baselineRun: { runId: 'run-0', finishedAt: '2026-10-18T10:00:00' },
  comparable: true,
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
  evidence: [
    {
      code: 'VERSION',
      label: '版本钉住',
      status: 'AVAILABLE',
      detail: '已固定 v3',
    },
  ],
  notConnected: ['LLM_JUDGE'],
};

const RUN_DETAIL: EvalRunDetail = {
  run: {
    runId: 'run-1',
    kbId: 'kb-1',
    status: 'COMPLETED',
    resultUsable: true,
    datasetVersionNo: 'v3',
    snapshotId: 'snap-1',
    configVersion: 'cfg-9',
    judgeMode: 'RULE',
    judgeVersion: 'j1',
    indexGeneration: 3,
    caseTotal: 12,
    caseDone: 12,
    finishedAt: '2026-10-20T10:00:00',
    durationMs: 65000,
  },
  metrics: [
    {
      metricCode: 'answer_accuracy',
      metricName: '答案准确率',
      metricLayer: 'CORE',
      value: 0.83,
      unit: 'ratio',
      targetValue: 0.8,
      status: 'PASS',
    },
    {
      metricCode: 'index_ready',
      metricName: '索引就绪',
      metricLayer: 'PRECONDITION',
      value: 1,
      unit: 'ratio',
      targetValue: 1,
      status: 'PASS',
    },
    {
      metricCode: 'latency_p95',
      metricName: 'P95 延迟',
      metricLayer: 'RUNTIME',
      value: 1800,
      unit: 'ms',
      targetValue: 2000,
      status: 'PASS',
    },
  ],
  stages: [
    {
      stageCode: 'RETRIEVAL',
      stageName: '召回',
      status: 'PASS',
      failingCaseCount: 2,
      metrics: [
        {
          metricCode: 'recall_at_5',
          metricName: '召回@5',
          metricLayer: 'DIAGNOSTIC',
          value: 0.72,
          unit: 'ratio',
          targetValue: 0.75,
          status: 'WARN',
        },
      ],
    },
  ],
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
  evidence: OVERVIEW.evidence,
  comparable: true,
};

const CASE_PAGE = {
  records: [
    {
      caseId: 'case-1',
      caseNo: 1,
      question: '发热患者如何分级？',
      answer: '按体温分级处理。',
      answerMode: 'ANSWER',
      badcaseStages: ['RETRIEVAL'],
    },
  ],
  total: 1,
};

const BADCASES = {
  records: [
    {
      badcaseId: 'bc-1',
      caseId: 'case-1',
      question: '发热患者如何分级？',
      stageCode: 'RETRIEVAL',
      severity: 'HIGH',
      status: 'OPEN',
      occurrenceCount: 3,
      lastSeenRunId: 'run-1',
    },
  ],
  total: 1,
};

const DATASET: EvalDatasetDetail = {
  dataset: { versionNo: 'v3', status: 'PUBLISHED', caseCount: 1 },
  cases: [
    {
      caseId: 'case-1',
      caseNo: 1,
      question: '发热患者如何分级？',
      expectedAnswer: '按体温分级',
      expectedBehavior: 'ANSWER',
      expectedEvidence: { materialId: 'mat-1' },
      tags: ['分级'],
    },
  ],
};

const TRUST: EvalTrustEvidence = {
  items: [
    {
      code: 'VERSION',
      label: '版本钉住',
      status: 'AVAILABLE',
      detail: '数据集 v3 已钉住',
    },
  ],
};

beforeEach(() => {
  sessionStorage.clear();
  [overviewMock, runMock, datasetMock, saveMock, publishMock, createMock,
    pageCasesMock, badcasesMock, trustMock, updateMock].forEach((mock) =>
    mock.mockReset(),
  );
  overviewMock.mockResolvedValue(OVERVIEW);
  runMock.mockResolvedValue(RUN_DETAIL);
  datasetMock.mockResolvedValue(DATASET);
  saveMock.mockResolvedValue({});
  publishMock.mockResolvedValue({});
  createMock.mockResolvedValue({
    runId: 'run-2',
    status: 'COMPLETED',
    resultUsable: true,
    datasetVersionNo: 'v3',
  });
  pageCasesMock.mockResolvedValue(CASE_PAGE);
  badcasesMock.mockResolvedValue(BADCASES);
  trustMock.mockResolvedValue(TRUST);
  updateMock.mockResolvedValue({});
});

function renderDetail(route: string) {
  return renderAt(
    <Routes>
      <Route
        path="/knowledge-bases/:kbId/evaluation"
        element={<EvaluationWorkbenchPage />}
      />
      <Route path="/evaluations" element={<EvaluationWorkbenchPage />} />
    </Routes>,
    { route },
  );
}

afterEach(() => {
  cleanup();
});

describe('EvaluationWorkbenchPage', () => {
  it('默认展示本次结果并加载概览与跑批', async () => {
    renderDetail(BASE_ROUTE);
    expect(await screen.findByText('护理知识库')).toBeInTheDocument();
    expect(overviewMock).toHaveBeenCalledWith('kb-1', undefined);
    await waitFor(() => expect(runMock).toHaveBeenCalledWith('run-1'));
    expect(screen.getByRole('button', { name: /本次结果/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /指标总览/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /阶段诊断/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /坏例与回归/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /测评跑批/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '概览' })).not.toBeInTheDocument();
    expect(await screen.findByText('答案准确率')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText(/当前跑批/)).toBeInTheDocument();
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('cfg-9').length).toBeGreaterThanOrEqual(1);
  });

  it('通过 URL 打开概览子页', async () => {
    renderDetail(`${BASE_ROUTE}?view=overview`);
    expect(await screen.findByText('QA 集合版本')).toBeInTheDocument();
    expect(screen.getByText('已冻结版本可发起')).toBeInTheDocument();
    expect(screen.getByText('已修复 3 · 回归 1')).toBeInTheDocument();
  });

  it('页签切换展示指标、阶段与坏例', async () => {
    renderDetail(BASE_ROUTE);
    await screen.findByText('答案准确率');

    fireEvent.click(screen.getByRole('button', { name: /指标总览/ }));
    expect(await screen.findByText('共 4 项指标')).toBeInTheDocument();
    expect(screen.getByText('全部 · 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /阶段诊断/ }));
    expect(await screen.findByText('RAG 全链路')).toBeInTheDocument();
    expect(screen.getAllByText('召回@5').length).toBeGreaterThanOrEqual(1);
    await waitFor(() =>
      expect(pageCasesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          onlyBad: true,
          stageCode: 'RETRIEVAL',
        }),
      ),
    );

    fireEvent.click(screen.getAllByRole('button', { name: /坏例与回归/ })[0]);
    expect(await screen.findByText('坏例台账')).toBeInTheDocument();
    expect(badcasesMock).toHaveBeenCalledWith('kb-1', undefined);
    expect(await screen.findByText('发热患者如何分级？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /测评跑批/ }));
    expect(await screen.findByText('跑批记录')).toBeInTheDocument();
    expect(screen.getByText('本会话已知跑批')).toBeInTheDocument();
    expect(screen.getByText('本次')).toBeInTheDocument();
  });

  it('发起跑批后跳到新 runId', async () => {
    renderDetail(BASE_ROUTE);
    await screen.findByText('答案准确率');

    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('QA 版本已冻结')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /发起跑批/ }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      kbId: 'kb-1',
      datasetVersionNo: 'v3',
      allowReuse: true,
    });
    await waitFor(() => expect(runMock).toHaveBeenCalledWith('run-2'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('编辑 QA 集合与查看可信证据', async () => {
    renderDetail(BASE_ROUTE);
    await screen.findByText('答案准确率');

    fireEvent.click(screen.getByRole('button', { name: /编辑 QA 集合/ }));
    await waitFor(() => expect(datasetMock).toHaveBeenCalledWith('kb-1'));
    expect(await screen.findByText('题目列表')).toBeInTheDocument();
    expect(screen.getByText('按体温分级')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByText('题目列表')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '凭什么可用' })[0]);
    expect(await screen.findByText('五类证据口径')).toBeInTheDocument();
    expect(trustMock).toHaveBeenCalledWith('run-1');
    expect(screen.getByText('数据集 v3 已钉住')).toBeInTheDocument();
  });

  it('URL 指定 runId 与基线时按参数查询', async () => {
    renderDetail(`${BASE_ROUTE}?view=result&runId=run-9&baselineRunId=run-0`);
    await waitFor(() => expect(runMock).toHaveBeenCalledWith('run-9'));
    expect(overviewMock).toHaveBeenCalledWith('kb-1', 'run-0');
    expect(screen.getAllByText('run-9').length).toBeGreaterThanOrEqual(1);
  });

  it('缺少 kbId 时展示深链错误', () => {
    renderDetail('/evaluations');
    expect(screen.getByText('缺少知识库标识')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回评测库' })).toBeInTheDocument();
    expect(overviewMock).not.toHaveBeenCalled();
    expect(runMock).not.toHaveBeenCalled();
  });

  it('概览失败时提示且跑批页保留真实记录说明', async () => {
    overviewMock.mockResolvedValue(undefined);
    renderDetail(`${BASE_ROUTE}?view=runs`);
    expect(await screen.findByText('评测概览刷新失败')).toBeInTheDocument();
    expect(screen.getByText('库级概览暂不可用')).toBeInTheDocument();
    expect(screen.getByText('还没有已加载的跑批记录')).toBeInTheDocument();
    expect(runMock).not.toHaveBeenCalled();
  });

  it('跑批明细失败时可重试', async () => {
    runMock.mockResolvedValue(undefined);
    renderDetail(BASE_ROUTE);
    expect(await screen.findByText('跑批明细加载失败')).toBeInTheDocument();
    const before = runMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() =>
      expect(runMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('深链打开坏例抽屉', async () => {
    renderDetail(`${BASE_ROUTE}?view=cases&caseId=case-1&status=OPEN`);
    expect(await screen.findByText('坏例明细')).toBeInTheDocument();
    expect(badcasesMock).toHaveBeenCalledWith('kb-1', 'OPEN');
    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByText('按体温分级处理。'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: '关闭' })[0]);
    await waitFor(() =>
      expect(screen.queryByText('坏例明细')).not.toBeInTheDocument(),
    );
  });
});
