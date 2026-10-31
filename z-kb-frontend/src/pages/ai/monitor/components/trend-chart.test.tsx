import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrendChart from '@/pages/ai/monitor/components/trend-chart';
import type { TrendPoint } from '@/pages/ai/monitor/mock';

const points: TrendPoint[] = [
  { key: 'a', label: '10:00', success: 12, failed: 2, total: 14 },
  { key: 'b', label: '11:00', success: 20, failed: 0, total: 20 },
  { key: 'c', label: '12:00', success: 5, failed: 3, total: 8 },
];

describe('TrendChart', () => {
  it('渲染图例、时间标签与柱体悬浮信息', () => {
    const { container } = render(<TrendChart points={points} />);

    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败 / 超时')).toBeInTheDocument();
    expect(container.querySelectorAll('.trend-col')).toHaveLength(3);
    expect(container.querySelectorAll('.trend-bars')[0]).toHaveAttribute(
      'title',
      '10:00 · 成功 12 · 失败/超时 2',
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('空数据时只保留图例', () => {
    const { container } = render(<TrendChart points={[]} />);
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(container.querySelectorAll('.trend-col')).toHaveLength(0);
  });
});
