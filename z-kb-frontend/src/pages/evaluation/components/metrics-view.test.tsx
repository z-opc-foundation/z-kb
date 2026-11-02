import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvalRunDetail } from '@/services/evaluation';
import MetricsView from './metrics-view';

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
      metricCode: 'answer_accuracy',
      metricName: '答案准确率',
      metricLayer: 'CORE',
      value: 0.83,
      unit: 'ratio',
      targetValue: 0.8,
      status: 'PASS',
      attribution: '生成',
      note: '本地规则',
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
      metricCode: 'recall_at_5',
      metricName: '召回@5',
      metricLayer: 'DIAGNOSTIC',
      stageCode: 'RETRIEVAL',
      value: 0.72,
      unit: 'ratio',
      targetValue: 0.75,
      status: 'WARN',
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

function renderView(overrides: Partial<ComponentProps<typeof MetricsView>> = {}) {
  const props = {
    runDetail: RUN_DETAIL,
    loading: false,
    error: false,
    layer: '',
    onLayerChange: vi.fn(),
    onRetry: vi.fn(),
    onCreateRun: vi.fn(),
    ...overrides,
  };
  return { ...render(<MetricsView {...props} />), props };
}

afterEach(() => {
  cleanup();
});

describe('MetricsView', () => {
  it('加载中展示占位', () => {
    renderView({ loading: true });
    expect(screen.getByText('正在加载指标总览…')).toBeInTheDocument();
  });

  it('无跑批且错误时展示错误态并重试', () => {
    const { props } = renderView({ runDetail: null, error: true });
    expect(screen.getByText('指标数据加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('无跑批且无错误时展示空态并可发起跑批', () => {
    const { props } = renderView({ runDetail: null });
    expect(screen.getByText('尚未发起跑批')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    expect(props.onCreateRun).toHaveBeenCalledTimes(1);
  });

  it('展示全部指标、分层计数与基线 Δ', () => {
    renderView();
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('共 5 项指标')).toBeInTheDocument();
    expect(screen.getByText('基线 run-0 · 同口径')).toBeInTheDocument();
    expect(screen.getByText('全部 · 5')).toBeInTheDocument();
    expect(screen.getByText('核心结果 · 2')).toBeInTheDocument();
    expect(screen.getByText('前置条件 · 1')).toBeInTheDocument();
    expect(screen.getByText('诊断 · 1')).toBeInTheDocument();
    expect(screen.getByText('运行 · 1')).toBeInTheDocument();
    expect(screen.getByText('阶段 · 0')).toBeInTheDocument();

    expect(screen.getByText('答案准确率')).toBeInTheDocument();
    expect(screen.getByText('answer_accuracy')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+8%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getAllByText('达标').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('低于目标')).toBeInTheDocument();
    expect(screen.getByText('生成')).toBeInTheDocument();
    expect(screen.getByText('本地规则')).toBeInTheDocument();
    expect(screen.getByText('recall_at_5 · RETRIEVAL')).toBeInTheDocument();
    expect(screen.getByText('1800 ms')).toBeInTheDocument();
  });

  it('点击分层 chip 触发 onLayerChange，空层展示空态', () => {
    const { props, rerender } = renderView();
    fireEvent.click(screen.getByRole('button', { name: '核心结果 · 2' }));
    expect(props.onLayerChange).toHaveBeenCalledWith('CORE');

    rerender(<MetricsView {...props} layer="CORE" />);
    expect(screen.getByText('答案准确率')).toBeInTheDocument();
    expect(screen.getByText('引用命中')).toBeInTheDocument();
    expect(screen.queryByText('召回@5')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 5 项 · 层与层不做加权总分')).toBeInTheDocument();

    rerender(<MetricsView {...props} layer="STAGE" />);
    expect(screen.getByText('当前层级没有指标')).toBeInTheDocument();
  });

  it('基线不可比较时隐藏 Δ 并提示', () => {
    renderView({
      runDetail: { ...RUN_DETAIL, comparable: false },
    });
    expect(screen.getByText('不可直接比较')).toBeInTheDocument();
    expect(screen.queryByText('+8%')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Δ' })).not.toBeInTheDocument();
  });

  it('未设置基线时只展示本次', () => {
    renderView({ runDetail: { ...RUN_DETAIL, baseline: null } });
    expect(screen.getByText('未设置基线，只展示本次')).toBeInTheDocument();
    expect(screen.queryByText('+8%')).not.toBeInTheDocument();
  });
});
