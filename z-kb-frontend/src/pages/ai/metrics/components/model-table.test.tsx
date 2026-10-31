import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ModelTable from '@/pages/ai/metrics/components/model-table';
import type { ModelMetric } from '@/pages/ai/metrics/mock';

const base: ModelMetric = {
  key: 'qwen36-flash',
  model: 'qwen3.6-flash',
  usage: 'Wiki 生成',
  calls: 1200,
  successRate: 98.75,
  avgMs: 620,
  p95Ms: 1800,
  inputTokens: 1_500_000,
  outputTokens: 12_345,
  cost: 1.234,
};

describe('ModelTable', () => {
  it('按行渲染模型指标并格式化 Token 与成本', () => {
    const local: ModelMetric = {
      key: 'local-standin',
      model: 'local-standin',
      usage: '离线兜底',
      calls: 40,
      successRate: 100,
      avgMs: 96,
      p95Ms: 220,
      inputTokens: 5000,
      outputTokens: 0,
      cost: 0,
    };
    render(<ModelTable models={[base, local]} />);

    expect(screen.getByText('qwen3.6-flash')).toBeInTheDocument();
    expect(screen.getByText('galaxy 远端')).toBeInTheDocument();
    expect(screen.getByText('离线兜底')).toBeInTheDocument();
    expect(screen.getByText('本地确定性替身')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('98.75%')).toBeInTheDocument();
    expect(screen.getByText('1.50M')).toBeInTheDocument();
    expect(screen.getByText('12.3K')).toBeInTheDocument();
    expect(screen.getByText('¥ 1.23')).toBeInTheDocument();
    // 本地替身无输出 Token 与成本
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('按调用量排序')).toBeInTheDocument();
  });

  it('空列表只保留表头', () => {
    const { container } = render(<ModelTable models={[]} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(container.querySelectorAll('thead th')).toHaveLength(9);
  });
});
