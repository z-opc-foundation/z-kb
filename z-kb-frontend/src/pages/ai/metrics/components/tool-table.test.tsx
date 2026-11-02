import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolTable from '@/pages/ai/metrics/components/tool-table';
import type { ToolMetric } from '@/pages/ai/metrics/mock';

const tools: ToolMetric[] = [
  {
    key: 'knowledge_search',
    name: '知识库检索',
    code: 'knowledge_search',
    calls: 2300,
    successRate: 99.12,
    avgMs: 320,
    p95Ms: 880,
    timeoutRate: 0.8,
  },
  {
    key: 'kb_compile',
    name: 'Wiki 编译',
    code: 'kb_compile',
    calls: 400,
    successRate: 96.5,
    avgMs: 2400,
    p95Ms: 5200,
    timeoutRate: 1.6,
  },
];

describe('ToolTable', () => {
  it('渲染工具名、编码与耗时', () => {
    const { container } = render(<ToolTable tools={tools} />);
    expect(screen.getByText('知识库检索')).toBeInTheDocument();
    expect(screen.getByText('knowledge_search')).toBeInTheDocument();
    expect(screen.getByText('2,300')).toBeInTheDocument();
    expect(screen.getByText('99.12%')).toBeInTheDocument();
    expect(screen.getByText('2,400 ms')).toBeInTheDocument();
    expect(screen.getByText('5,200 ms')).toBeInTheDocument();
    expect(screen.getByText('0.80%')).toBeInTheDocument();
    expect(screen.getByText('1.60%')).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('空列表只保留表头', () => {
    const { container } = render(<ToolTable tools={[]} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(container.querySelectorAll('thead th')).toHaveLength(6);
  });
});
