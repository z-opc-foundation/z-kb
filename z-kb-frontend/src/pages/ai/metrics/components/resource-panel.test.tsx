import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResourcePanel from '@/pages/ai/metrics/components/resource-panel';
import type { ResourceItem } from '@/pages/ai/metrics/mock';

const items: ResourceItem[] = [
  {
    key: 'cpu',
    label: '推理 CPU',
    used: 85,
    capacity: 100,
    unit: '%',
    note: '8 vCPU',
  },
  {
    key: 'concurrency',
    label: '推理并发',
    used: 80,
    capacity: 128,
    unit: '路',
    note: '峰值 15:00',
  },
  {
    key: 'storage',
    label: '向量索引空间',
    used: 40,
    capacity: 100,
    unit: '%',
    note: '6 个 collection',
  },
];

describe('ResourcePanel', () => {
  it('按单位格式化用量并标注水位颜色', () => {
    const { container } = render(<ResourcePanel items={items} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('80 / 128 路')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('峰值 15:00')).toBeInTheDocument();

    const bars = container.querySelectorAll('.res-row .progress');
    expect(bars[0]).toHaveClass('red');
    expect(bars[1]).toHaveClass('amber');
    expect(bars[2]).not.toHaveClass('red');
    expect(bars[2]).not.toHaveClass('amber');
  });

  it('空列表只渲染面板标题', () => {
    render(<ResourcePanel items={[]} />);
    expect(screen.getByText('资源水位')).toBeInTheDocument();
  });
});
