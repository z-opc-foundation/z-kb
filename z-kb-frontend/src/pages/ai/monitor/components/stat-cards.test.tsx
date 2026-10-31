import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatCards from '@/pages/ai/monitor/components/stat-cards';
import type { MonitorSnapshot } from '@/pages/ai/monitor/mock';

function snapshot(total: number, successRate: number, p95Ms: number, failed: number): MonitorSnapshot {
  return {
    events: [],
    stats: { total, success: total - failed, failed, successRate, avgMs: 400, p95Ms },
    trend: [],
    toolStats: [],
    failureStats: [],
  };
}

describe('StatCards', () => {
  it('渲染当前周期数值与环比方向', () => {
    const { container } = render(
      <StatCards
        snapshot={snapshot(1000, 95.25, 1500, 40)}
        previous={snapshot(800, 93.75, 1600, 35)}
      />,
    );

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('95.3')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(container.textContent).toContain('↑ 25.0%');
    expect(container.textContent).toContain('↑ 1.5pp');
    // P95 下降是好事
    expect(container.textContent).toContain('↓ 100.0 ms');
    // 失败数上升是坏事
    expect(container.textContent).toContain('↑ 5.0 次');
    expect(container.querySelectorAll('.up')).toHaveLength(3);
    expect(container.querySelectorAll('.down')).toHaveLength(1);
  });

  it('缺少快照时显示占位；数值持平时提示持平', () => {
    const { rerender } = render(<StatCards />);
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getAllByText('暂无可比周期')).toHaveLength(4);

    rerender(
      <StatCards
        snapshot={snapshot(100, 99, 500, 1)}
        previous={snapshot(100, 99, 500, 1)}
      />,
    );
    expect(screen.getAllByText('与上一周期持平')).toHaveLength(4);
  });
});
