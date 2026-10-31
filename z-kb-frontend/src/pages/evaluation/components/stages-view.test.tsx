import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvalRunDetail } from '@/services/evaluation';
import { pageEvalCaseResults } from '@/services/evaluation';
import StagesView from './stages-view';

vi.mock('@/services/evaluation', () => ({
  pageEvalCaseResults: vi.fn(),
}));

const pageCasesMock = vi.mocked(pageEvalCaseResults);

const RUN_DETAIL: EvalRunDetail = {
  run: {
    runId: 'run-1',
    kbId: 'kb-1',
    status: 'COMPLETED',
    resultUsable: true,
    finishedAt: '2026-10-20T10:00:00',
  },
  metrics: [
    {
      metricCode: 'answer_quality',
      metricName: '生成质量',
      metricLayer: 'CORE',
      stageCode: 'GENERATION',
      value: 0.9,
      unit: 'ratio',
      targetValue: 0.85,
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
    {
      stageCode: 'GENERATION',
      stageName: '生成',
      status: 'WARN',
      failingCaseCount: 1,
    },
  ],
};

const CASES = {
  records: [
    {
      caseId: 'case-1',
      caseNo: 1,
      question: '发热患者如何分级？',
      answerMode: 'ANSWER',
      badcaseStages: ['RETRIEVAL'],
      latencyMs: 1200,
      errorMessage: '召回为空',
    },
  ],
  total: 1,
};

function renderView(overrides: Partial<ComponentProps<typeof StagesView>> = {}) {
  const props = {
    kbId: 'kb-1',
    runDetail: RUN_DETAIL,
    loading: false,
    error: false,
    stageCode: '',
    onStageChange: vi.fn(),
    onOpenCase: vi.fn(),
    onCreateRun: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  return { ...render(<StagesView {...props} />), props };
}

beforeEach(() => {
  pageCasesMock.mockReset();
  pageCasesMock.mockResolvedValue(CASES);
});

afterEach(() => {
  cleanup();
});

describe('StagesView', () => {
  it('加载中展示占位', () => {
    renderView({ loading: true });
    expect(screen.getByText('正在加载阶段诊断…')).toBeInTheDocument();
  });

  it('无跑批时区分错误态与空态', () => {
    const { props, rerender } = renderView({ runDetail: null, error: true });
    expect(screen.getByText('阶段诊断加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);

    rerender(<StagesView {...props} runDetail={null} error={false} />);
    expect(screen.getByText('尚未发起跑批')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    expect(props.onCreateRun).toHaveBeenCalledTimes(1);
  });

  it('跑批没有阶段数据时提示并重试', () => {
    const { props } = renderView({
      runDetail: { run: RUN_DETAIL.run, stages: [] },
    });
    expect(screen.getByText('本次跑批未返回阶段诊断')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('展示阶段链路、阶段指标与本阶段逐题坏例', async () => {
    const { props } = renderView();
    expect(screen.getByText('RAG 全链路')).toBeInTheDocument();
    expect(screen.getByText('1 段达标 · 共 2 段 · 点击切换')).toBeInTheDocument();
    expect(screen.getByTitle('召回')).toBeInTheDocument();
    expect(screen.getAllByText('召回@5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('72%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('目标 75% · 诊断')).toBeInTheDocument();
    expect(screen.getAllByText('2 条失败坏例').length).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText('发热患者如何分级？')).toBeInTheDocument();
    expect(screen.getByText('作答')).toBeInTheDocument();
    expect(screen.getAllByText('RETRIEVAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1.2 s')).toBeInTheDocument();
    expect(screen.getByText('召回为空')).toBeInTheDocument();
    expect(pageCasesMock).toHaveBeenCalledWith({
      runId: 'run-1',
      current: 1,
      size: 50,
      onlyBad: true,
      stageCode: 'RETRIEVAL',
    });

    fireEvent.click(screen.getByRole('button', { name: /查看明细/ }));
    expect(props.onOpenCase).toHaveBeenCalledWith('case-1');
    fireEvent.click(screen.getByTitle('生成'));
    expect(props.onStageChange).toHaveBeenCalledWith('GENERATION');

    const stageListButton = document.querySelector('.binding-row') as HTMLElement;
    fireEvent.click(stageListButton);
    expect(props.onStageChange).toHaveBeenCalled();
  });

  it('指定阶段时优先展示该阶段并按 stageCode 回退指标', () => {
    renderView({ stageCode: 'GENERATION' });
    expect(screen.getByText('生成质量')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('目标 85% · 核心结果')).toBeInTheDocument();
    expect(pageCasesMock).toHaveBeenCalledWith(
      expect.objectContaining({ stageCode: 'GENERATION' }),
    );
  });

  it('逐题坏例加载失败可重试', async () => {
    pageCasesMock.mockResolvedValue(undefined);
    renderView();
    expect(await screen.findByText('逐题坏例加载失败')).toBeInTheDocument();
    const before = pageCasesMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() =>
      expect(pageCasesMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('本阶段没有坏例时展示空态并支持刷新', async () => {
    pageCasesMock.mockResolvedValue({ records: [], total: 0 });
    renderView();
    expect(await screen.findByText('本阶段没有逐题坏例')).toBeInTheDocument();
    expect(
      screen.getByText('后端声明 2 条失败坏例，但逐题接口未返回记录。'),
    ).toBeInTheDocument();
    const before = pageCasesMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() =>
      expect(pageCasesMock.mock.calls.length).toBeGreaterThan(before),
    );
  });
});
