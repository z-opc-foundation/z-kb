import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvalOverview, EvalRunDetail } from '@/services/evaluation';
import OverviewView from './overview-view';

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
    { code: 'COVERAGE', label: '覆盖范围', status: 'PARTIAL' },
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
    finishedAt: '2026-10-20T10:00:00',
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
      metricCode: 'latency_p95',
      metricName: 'P95 延迟',
      metricLayer: 'RUNTIME',
      value: 1800,
      unit: 'ms',
      targetValue: 2000,
      status: 'PASS',
    },
  ],
};

function renderView(overrides: Partial<ComponentProps<typeof OverviewView>> = {}) {
  const props = {
    overview: OVERVIEW,
    runDetail: RUN_DETAIL,
    loading: false,
    error: false,
    onRetry: vi.fn(),
    onCreateRun: vi.fn(),
    onEditDataset: vi.fn(),
    onOpenResult: vi.fn(),
    onOpenCases: vi.fn(),
    onOpenTrust: vi.fn(),
    ...overrides,
  };
  return { ...render(<OverviewView {...props} />), props };
}

afterEach(() => {
  cleanup();
});

describe('OverviewView', () => {
  it('加载中展示占位', () => {
    renderView({ loading: true });
    expect(screen.getByText('正在加载单库评测概览…')).toBeInTheDocument();
  });

  it('错误且无概览时展示错误态并可重试', () => {
    const { props } = renderView({ overview: null, error: true });
    expect(screen.getByText('评测概览加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('展示 QA 版本、最近跑批、核心达标、坏例与证据', () => {
    renderView();
    expect(screen.getAllByText('v3').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('5 / 6')).toBeInTheDocument();
    expect(screen.getByText('已修复 3 · 回归 1')).toBeInTheDocument();
    expect(screen.getByText('已冻结版本可发起')).toBeInTheDocument();
    expect(screen.getAllByText('已发布').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('12 题')).toBeInTheDocument();
    expect(screen.getByText('2026-10-19 09:00')).toBeInTheDocument();
    expect(screen.getByText('1m 5s')).toBeInTheDocument();

    expect(screen.getByText('答案准确率')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('目标 80%')).toBeInTheDocument();

    expect(screen.getByText('版本钉住')).toBeInTheDocument();
    expect(screen.getByText('已固定 v3')).toBeInTheDocument();
    expect(screen.getByText('部分具备')).toBeInTheDocument();
    expect(screen.getByText('LLM Judge · 未接入')).toBeInTheDocument();
    expect(screen.getByText('成本 · 未接入')).toBeInTheDocument();
  });

  it('概览入口按钮回调', () => {
    const { props } = renderView();
    fireEvent.click(screen.getByRole('button', { name: /进入本次结果/ }));
    fireEvent.click(screen.getByRole('button', { name: /查看台账/ }));
    fireEvent.click(screen.getByRole('button', { name: '凭什么可用' }));
    fireEvent.click(screen.getByRole('button', { name: /管理/ }));
    expect(props.onOpenResult).toHaveBeenCalledTimes(1);
    expect(props.onOpenCases).toHaveBeenCalledTimes(1);
    expect(props.onOpenTrust).toHaveBeenCalledTimes(1);
    expect(props.onEditDataset).toHaveBeenCalledTimes(1);
  });

  it('无跑批时展示空态并允许发起跑批/编辑 QA', () => {
    const { props } = renderView({
      overview: { ...OVERVIEW, lastRun: null, badcaseCounts: null },
      runDetail: null,
    });
    expect(screen.getByText('尚无跑批结果')).toBeInTheDocument();
    expect(screen.getAllByText('未跑批').length).toBeGreaterThanOrEqual(1);
    const createButtons = screen.getAllByRole('button', { name: /发起跑批/ });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(createButtons[0]);
    expect(props.onCreateRun).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /编辑 QA 集合/ }));
    expect(props.onEditDataset).toHaveBeenCalledTimes(1);

    const trustButton = screen.getByRole('button', { name: '凭什么可用' });
    expect(trustButton).toBeDisabled();
  });

  it('QA 版本缺失时提示需先发布', () => {
    renderView({
      overview: {
        kbId: 'kb-1',
        dataset: { status: 'DRAFT', caseCount: null },
        notConnected: null,
        evidence: null,
      },
      runDetail: null,
    });
    expect(screen.getAllByText('未配置').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('需先发布')).toBeInTheDocument();
    expect(screen.getByText('题数未知')).toBeInTheDocument();
    expect(
      screen.getByText('接口未返回证据项；不以页面硬编码状态补齐。'),
    ).toBeInTheDocument();
    expect(screen.getByText('暂无未接入能力记录。')).toBeInTheDocument();
  });
});
