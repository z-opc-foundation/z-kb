import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiMetricsPage from '@/pages/ai/metrics/index';
import type { MetricsSnapshot } from '@/pages/ai/metrics/mock';
import { useMetrics } from '@/pages/ai/metrics/hooks/use-metrics';

vi.mock('@/pages/ai/metrics/hooks/use-metrics', () => ({
  useMetrics: vi.fn(),
}));

vi.mock('@/pages/ai/shared', async () => {
  const React = await import('react');
  return {
    AiLoading: ({ text }: { text: string }) =>
      React.createElement('div', null, text),
  };
});

const snapshot: MetricsSnapshot = {
  summary: {
    calls: 1234,
    tokens: 5678,
    avgMs: 600,
    p95Ms: 1800,
    successRate: 99.1,
    retrievalHitRate: 88,
    cacheHitRate: 75,
    rateLimited: 3,
  },
  previous: {
    calls: 1000,
    tokens: 5000,
    avgMs: 650,
    p95Ms: 1900,
    successRate: 98.8,
    retrievalHitRate: 86,
    cacheHitRate: 70,
    rateLimited: 5,
  },
  throughput: [
    { key: 'a', label: '10:00', calls: 100 },
    { key: 'b', label: '11:00', calls: 200 },
  ],
  latency: { p50: 400, p90: 900, p95: 1800, p99: 2400 },
  stages: [{ key: 'generate', label: 'LLM 生成', ms: 600, share: 100 }],
  models: [
    {
      key: 'qwen36-flash',
      model: 'qwen3.6-flash',
      usage: 'Wiki 生成',
      calls: 100,
      successRate: 99,
      avgMs: 620,
      p95Ms: 1800,
      inputTokens: 12000,
      outputTokens: 500,
      cost: 0.2,
    },
  ],
  tools: [
    {
      key: 'knowledge_search',
      name: '知识库检索',
      code: 'knowledge_search',
      calls: 900,
      successRate: 99.5,
      avgMs: 320,
      p95Ms: 880,
      timeoutRate: 0.4,
    },
  ],
  slos: [
    {
      key: 'availability',
      label: '服务可用性',
      target: '≥ 99.90%',
      actual: '99.95%',
      ratio: 100,
      met: true,
    },
  ],
  resources: [
    {
      key: 'cpu',
      label: '推理 CPU',
      used: 46,
      capacity: 100,
      unit: '%',
      note: '8 vCPU',
    },
  ],
};

const refresh = vi.fn();

function setMetricsState(state: {
  loading: boolean;
  snapshot?: MetricsSnapshot;
}) {
  vi.mocked(useMetrics).mockReturnValue({ ...state, refresh });
}

describe('AiMetricsPage', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(useMetrics).mockReset();
  });

  it('首次加载展示加载提示', () => {
    setMetricsState({ loading: true });
    render(<AiMetricsPage />);
    expect(screen.getByText('正在汇总技术指标…')).toBeInTheDocument();
    expect(useMetrics).toHaveBeenCalledWith('24h');
  });

  it('加载成功后渲染各指标区块', () => {
    setMetricsState({ loading: false, snapshot });
    render(<AiMetricsPage />);

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('调用量分布')).toBeInTheDocument();
    expect(screen.getByText('资源水位')).toBeInTheDocument();
    expect(screen.getByText('延迟分位与链路耗时')).toBeInTheDocument();
    expect(screen.getByText('SLO 达成')).toBeInTheDocument();
    expect(screen.getByText('qwen3.6-flash')).toBeInTheDocument();
    expect(screen.getByText('知识库检索')).toBeInTheDocument();
    expect(screen.getAllByText('最近 24 小时').length).toBeGreaterThan(0);
  });

  it('切换时间范围会用新范围重新加载', () => {
    setMetricsState({ loading: false, snapshot });
    render(<AiMetricsPage />);

    fireEvent.click(screen.getByRole('button', { name: '最近 7 天' }));

    expect(useMetrics).toHaveBeenLastCalledWith('7d');
    expect(screen.getAllByText('最近 7 天').length).toBeGreaterThan(0);
  });

  it('点击刷新调用 hook 的 refresh', () => {
    setMetricsState({ loading: false, snapshot });
    render(<AiMetricsPage />);

    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
