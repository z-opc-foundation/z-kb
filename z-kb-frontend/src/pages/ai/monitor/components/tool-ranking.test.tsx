import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToolRanking from '@/pages/ai/monitor/components/tool-ranking';
import type { ToolStat } from '@/pages/ai/monitor/mock';

const toolStats: ToolStat[] = [
  {
    toolCode: 'knowledge_search',
    toolName: '知识库检索',
    calls: 4200,
    successRate: 98.1,
    avgMs: 420,
    p95Ms: 1100,
  },
  {
    toolCode: 'current_time',
    toolName: '当前时间',
    calls: 800,
    successRate: 99.9,
    avgMs: 12,
    p95Ms: 30,
  },
];

describe('ToolRanking', () => {
  it('渲染排行数据', () => {
    const { container } = render(
      <ToolRanking
        toolStats={toolStats}
        selectedTool=""
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('知识库检索')).toBeInTheDocument();
    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText('98.1%')).toBeInTheDocument();
    expect(screen.getByText('1,100 ms')).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('点击行选中工具，再次点击取消选中', () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <ToolRanking toolStats={toolStats} selectedTool="" onSelect={onSelect} />,
    );
    const rows = container.querySelectorAll<HTMLElement>('tbody tr');

    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith('knowledge_search');

    rerender(
      <ToolRanking
        toolStats={toolStats}
        selectedTool="knowledge_search"
        onSelect={onSelect}
      />,
    );
    expect(rows[0]).toHaveClass('selected');
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenLastCalledWith('');
  });
});
