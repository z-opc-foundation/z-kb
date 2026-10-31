import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SloPanel from '@/pages/ai/metrics/components/slo-panel';
import type { SloItem } from '@/pages/ai/metrics/mock';

const items: SloItem[] = [
  {
    key: 'availability',
    label: '服务可用性',
    target: '≥ 99.90%',
    actual: '99.95%',
    ratio: 100,
    met: true,
  },
  {
    key: 'p95',
    label: 'P95 延迟',
    target: '≤ 2,000 ms',
    actual: '2,400 ms',
    ratio: 83.3,
    met: false,
  },
];

describe('SloPanel', () => {
  it('统计达标数量并区分达成状态', () => {
    const { container } = render(<SloPanel items={items} />);

    expect(screen.getByText('1 / 2 达标')).toBeInTheDocument();
    expect(screen.getByText('目标 ≥ 99.90%')).toBeInTheDocument();
    expect(screen.getByText('99.95%')).toBeInTheDocument();
    expect(screen.getByText('达成')).toBeInTheDocument();
    expect(screen.getByText('未达成')).toBeInTheDocument();

    const bars = container.querySelectorAll('.slo-row .progress');
    expect(bars[0]).toHaveClass('green');
    expect(bars[1]).toHaveClass('red');
  });

  it('空列表显示 0 / 0 达标', () => {
    render(<SloPanel items={[]} />);
    expect(screen.getByText('0 / 0 达标')).toBeInTheDocument();
  });
});
