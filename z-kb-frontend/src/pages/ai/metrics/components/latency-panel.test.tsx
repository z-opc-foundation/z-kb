import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LatencyPanel from '@/pages/ai/metrics/components/latency-panel';

describe('LatencyPanel', () => {
  it('渲染分位与链路耗时的格式化数值', () => {
    const { container } = render(
      <LatencyPanel
        latency={{ p50: 420, p90: 910, p95: 1234, p99: 2400 }}
        stages={[
          { key: 'recall', label: '向量召回', ms: 180, share: 30 },
          { key: 'generate', label: 'LLM 生成', ms: 420, share: 70 },
        ]}
      />,
    );

    expect(screen.getByText('P50')).toBeInTheDocument();
    expect(screen.getByText('P99')).toBeInTheDocument();
    expect(screen.getAllByText(/420 ms/)).toHaveLength(2);
    expect(screen.getByText(/1,234 ms/)).toBeInTheDocument();
    expect(screen.getByText('向量召回')).toBeInTheDocument();
    expect(screen.getByText(/180 ms/)).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    // 4 个分位 + 2 个阶段
    expect(container.querySelectorAll('.lat-row')).toHaveLength(6);
  });

  it('最大值为 0 时进度条宽度不出现 NaN', () => {
    const { container } = render(
      <LatencyPanel
        latency={{ p50: 0, p90: 0, p95: 0, p99: 0 }}
        stages={[{ key: 'none', label: '空阶段', ms: 0, share: 0 }]}
      />,
    );
    container.querySelectorAll<HTMLElement>('.progress > i').forEach((bar) => {
      expect(bar.style.width).toBe('0%');
    });
  });
});
