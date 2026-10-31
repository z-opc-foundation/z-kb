import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvalOverview, EvalRunDetail } from '@/services/evaluation';
import ResultView from './result-view';

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
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
  evidence: [
    {
      code: 'VERSION',
      label: '版本钉住',
      status: 'AVAILABLE',
      detail: '已固定 v3',
    },
  ],
  notConnected: ['LLM_JUDGE', 'COST'],
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
    taskConfigVersion: 'task-2',
    judgeMode: 'RULE',
    judgeVersion: 'j1',
    indexGeneration: 3,
    scopeType: 'FULL',
    caseTotal: 12,
    caseDone: 12,
    retrievalTruncated: true,
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
      metricCode: 'citation_hit',
      metricName: '引用命中',
      metricLayer: 'CORE',
      value: 0.6,
      unit: 'ratio',
      targetValue: 0.7,
      status: 'FAIL',
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
    },
    {
      stageCode: 'GENERATION',
      stageName: '生成',
      status: 'WARN',
      failingCaseCount: 1,
    },
  ],
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
  evidence: [
    {
      code: 'VERSION',
      label: '版本钉住',
      status: 'AVAILABLE',
      detail: '已固定 v3',
    },
  ],
  baseline: {
    runId: 'run-0',
    finishedAt: '2026-10-18T10:00:00',
    metrics: [
      { metricCode: 'answer_accuracy', value: 0.75, status: 'PASS' },
      { metricCode: 'latency_p95', value: 1500, status: 'PASS' },
    ],
  },
  comparable: true,
};

function renderView(overrides: Partial<ComponentProps<typeof ResultView>> = {}) {
  const props = {
    overview: OVERVIEW,
    runDetail: RUN_DETAIL,
    loading: false,
    error: false,
    reused: false,
    onRetry: vi.fn(),
    onCreateRun: vi.fn(),
    onEditDataset: vi.fn(),
    onOpenTrust: vi.fn(),
    onOpenCases: vi.fn(),
    onOpenMetrics: vi.fn(),
    onOpenStage: vi.fn(),
    ...overrides,
  };
  return { ...render(<ResultView {...props} />), props };
}

afterEach(() => {
  cleanup();
});

describe('ResultView', () => {
  it('加载中展示占位', () => {
    renderView({ loading: true });
    expect(screen.getByText('正在加载跑批结果…')).toBeInTheDocument();
  });

  it('错误且无跑批时展示错误态并重试', () => {
    const { props } = renderView({ runDetail: null, error: true });
    expect(screen.getByText('跑批明细加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('无跑批时展示空态与 QA 元信息', () => {
    const { props } = renderView({ runDetail: null });
    expect(screen.getByText('尚未发起跑批')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    fireEvent.click(screen.getByRole('button', { name: /编辑 QA 集合/ }));
    expect(props.onCreateRun).toHaveBeenCalledTimes(1);
    expect(props.onEditDataset).toHaveBeenCalledTimes(1);
  });

  it('成功态展示跑批上下文、核心/前置/运行指标、阶段与版本钉住', () => {
    renderView();
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('可用')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 10:00')).toBeInTheDocument();
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
    expect(screen.getByText('12 / 12')).toBeInTheDocument();
    expect(screen.getByText('检索截断')).toBeInTheDocument();

    expect(screen.getByText('P95 延迟')).toBeInTheDocument();
    expect(screen.getByText('1800 ms')).toBeInTheDocument();
    expect(screen.getByText('目标 2000 ms')).toBeInTheDocument();
    expect(screen.getByText('基线 1500 ms')).toBeInTheDocument();
    expect(screen.getByText('Δ +300')).toBeInTheDocument();

    expect(screen.getByText('目标 80% · 基线 75%')).toBeInTheDocument();
    expect(screen.getByText('Δ +8% · 同口径可比')).toBeInTheDocument();
    expect(screen.getByText('索引就绪')).toBeInTheDocument();
    expect(screen.getByText('目标 100% · 基线 —')).toBeInTheDocument();

    expect(screen.getByTitle('召回')).toBeInTheDocument();
    expect(screen.getByTitle('生成')).toBeInTheDocument();
    expect(screen.getByText('2 条失败坏例')).toBeInTheDocument();

    expect(screen.getByText('snap-1')).toBeInTheDocument();
    expect(screen.getByText('cfg-9')).toBeInTheDocument();
    expect(screen.getByText('task-2')).toBeInTheDocument();
    expect(screen.getByText('RULE · j1')).toBeInTheDocument();
    expect(screen.getByText('FULL')).toBeInTheDocument();
    expect(screen.getByText('全链路')).toBeInTheDocument();

    expect(screen.getAllByText('版本钉住').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('已固定 v3')).toBeInTheDocument();
    expect(screen.getByText('LLM Judge · 未接入')).toBeInTheDocument();
    expect(screen.getByText('成本 · 未接入')).toBeInTheDocument();
    expect(
      screen.getByText('2 待修复 · 3 已修复 · 1 回归'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '共 6 条坏例；修复动作回业务页面，关闭前需按同一数据集回归。',
      ),
    ).toBeInTheDocument();
  });

  it('成功态页面入口回调', () => {
    const { props } = renderView();
    fireEvent.click(screen.getAllByRole('button', { name: /全部指标/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /坏例与回归/ }));
    fireEvent.click(screen.getAllByRole('button', { name: '凭什么可用' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /逐段查看/ }));
    fireEvent.click(screen.getByTitle('生成'));
    expect(props.onOpenMetrics).toHaveBeenCalled();
    expect(props.onOpenCases).toHaveBeenCalledTimes(1);
    expect(props.onOpenTrust).toHaveBeenCalled();
    expect(props.onOpenStage).toHaveBeenCalledWith('RETRIEVAL');
    expect(props.onOpenStage).toHaveBeenCalledWith('GENERATION');
  });

  it('复用跑批与不可用结果展示提示', () => {
    renderView({
      reused: true,
      runDetail: {
        ...RUN_DETAIL,
        run: {
          ...RUN_DETAIL.run,
          resultUsable: false,
          unusableReason: '前置条件未达标',
        },
        baseline: null,
      },
    });
    expect(screen.getByText('已复用两小时内同口径跑批')).toBeInTheDocument();
    expect(screen.getByText('本次结果标记为不可用')).toBeInTheDocument();
    expect(screen.getByText('前置条件未达标')).toBeInTheDocument();
    expect(screen.getAllByText('未设置基线，只展示本次').length).toBeGreaterThanOrEqual(1);
  });

  it('基线不可比较时提示且不计算 Δ', () => {
    renderView({ runDetail: { ...RUN_DETAIL, comparable: false } });
    expect(screen.getByText('本次与基线不可直接比较')).toBeInTheDocument();
    expect(screen.queryByText('Δ +300')).not.toBeInTheDocument();
    expect(
      screen.getAllByText('数据集 / 配置 / Judge / 范围不同，不计算 Δ')[0],
    ).toBeInTheDocument();
  });

  it('缺少分层指标时回退摘要卡片与空态', () => {
    renderView({
      overview: null,
      runDetail: {
        run: {
          ...RUN_DETAIL.run,
          resultUsable: null,
          retrievalTruncated: false,
        },
        metrics: [],
        stages: [],
        evidence: null,
        badcaseCounts: null,
      },
    });
    expect(screen.getAllByText('本次结果').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('核心结果').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('前置条件').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('开放坏例')).toBeInTheDocument();
    expect(screen.getByText('本次跑批未返回核心指标')).toBeInTheDocument();
    expect(screen.getByText('本次跑批未返回前置条件')).toBeInTheDocument();
    expect(screen.getByText('本次跑批未返回阶段诊断数据。')).toBeInTheDocument();
    expect(
      screen.getByText('接口未返回证据项；不以页面硬编码状态补齐。'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('未标注').length).toBeGreaterThanOrEqual(1);
  });
});
