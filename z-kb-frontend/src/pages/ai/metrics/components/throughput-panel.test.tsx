import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThroughputPanel from '@/pages/ai/metrics/components/throughput-panel';
import type { ThroughputPoint } from '@/pages/ai/metrics/mock';

const points: ThroughputPoint[] = [
  { key: 'a', label: '10:00', calls: 320 },
  { key: 'b', label: '11:00', calls: 900 },
  { key: 'c', label: '12:00', calls: 480 },
];

describe('ThroughputPanel', () => {
  it('显示范围、峰值与全部柱体', () => {
    const { container } = render(
      <ThroughputPanel points={points} rangeLabel="最近 24 小时" />,
    );

    expect(screen.getByText('调用量分布')).toBeInTheDocument();
    expect(screen.getByText('最近 24 小时')).toBeInTheDocument();
    expect(screen.getByText('峰值 900 次 · 11:00')).toBeInTheDocument();
    expect(container.querySelectorAll('.col')).toHaveLength(3);
    expect(container.querySelectorAll('.bars')[1]).toHaveAttribute(
      'title',
      '11:00 · 900 次',
    );
  });

  it('没有数据点时不渲染面板', () => {
    const { container } = render(
      <ThroughputPanel points={[]} rangeLabel="最近 24 小时" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
