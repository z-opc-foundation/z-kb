import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummaryCards from '@/pages/ai/metrics/components/summary-cards';
import type { MetricsSummary } from '@/pages/ai/metrics/mock';

const summary: MetricsSummary = {
  calls: 2_500_000,
  tokens: 12_345,
  avgMs: 600,
  p95Ms: 1800,
  successRate: 98.5,
  retrievalHitRate: 86.4,
  cacheHitRate: 71.8,
  rateLimited: 12,
};

const previous: MetricsSummary = {
  calls: 2_000_000,
  tokens: 12_345,
  avgMs: 650,
  p95Ms: 1900,
  successRate: 98,
  retrievalHitRate: 86,
  cacheHitRate: 72,
  rateLimited: 10,
};

describe('SummaryCards', () => {
  it('格式化指标数值并计算环比', () => {
    const { container } = render(
      <SummaryCards summary={summary} previous={previous} />,
    );

    expect(screen.getByText('2.50M')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('1,800')).toBeInTheDocument();
    expect(screen.getByText('98.50')).toBeInTheDocument();
    expect(screen.getByText('86.4')).toBeInTheDocument();
    expect(screen.getByText('71.8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(container.textContent).toContain('↑ 25.0%');
    // Token 与上周期持平
    expect(screen.getAllByText('与上一周期持平')).toHaveLength(1);
    // 平均延迟下降是好事
    const good = container.querySelectorAll('.foot .up');
    expect(good.length).toBeGreaterThan(0);
    const bad = container.querySelectorAll('.foot .down');
    expect(bad.length).toBeGreaterThan(0);
  });

  it('缺少汇总数据时显示占位', () => {
    render(<SummaryCards />);
    expect(screen.getAllByText('—')).toHaveLength(8);
    expect(screen.getAllByText('暂无可比周期')).toHaveLength(8);
  });
});
