import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FailureReasons from '@/pages/ai/monitor/components/failure-reasons';
import type { FailureStat } from '@/pages/ai/monitor/mock';

const failureStats: FailureStat[] = [
  { label: '调用超时（> 8s）', count: 8, share: 61.5 },
  { label: '无权限访问知识库', count: 5, share: 38.5 },
];

describe('FailureReasons', () => {
  it('渲染失败总数与各原因占比', () => {
    const { container } = render(
      <FailureReasons failureStats={failureStats} failed={13} />,
    );

    expect(screen.getByText('共 13 次失败 / 超时')).toBeInTheDocument();
    expect(screen.getByText('调用超时（> 8s）')).toBeInTheDocument();
    expect(screen.getByText('8 次 · 62%')).toBeInTheDocument();
    expect(screen.getByText('5 次 · 39%')).toBeInTheDocument();
    expect(container.querySelectorAll('.ai-failure-row')).toHaveLength(2);
  });

  it('没有失败调用时展示空态文案', () => {
    render(<FailureReasons failureStats={[]} failed={0} />);
    expect(screen.getByText('该时间范围内没有失败调用。')).toBeInTheDocument();
  });
});
