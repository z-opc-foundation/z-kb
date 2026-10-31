import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownLite } from '@/pages/ai/markdown';

describe('MarkdownLite', () => {
  it('渲染标题、段落、引用与分隔线', () => {
    const { container } = render(
      <MarkdownLite
        content={[
          '# 一级标题',
          '## 二级标题',
          '### 三级标题',
          '',
          '普通段落',
          '> 引用内容',
          '---',
          '结束段落',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: '一级标题' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '二级标题' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '三级标题' })).toBeInTheDocument();
    expect(screen.getByText('普通段落')).toBeInTheDocument();
    expect(container.querySelector('blockquote')?.textContent).toBe('引用内容');
    expect(container.querySelectorAll('hr')).toHaveLength(1);
    expect(screen.getByText('结束段落')).toBeInTheDocument();
  });

  it('区分有序与无序列表，并渲染行内样式', () => {
    const { container } = render(
      <MarkdownLite
        content={[
          '- 无序一',
          '- 无序 **加粗**',
          '',
          '1. 有序一',
          '2. 有序二',
          '',
          '行内 `code` 与 [1] 以及 [12] 引用，链接 [示例](https://example.com/a)',
        ].join('\n')}
      />,
    );

    const unordered = container.querySelectorAll('ul');
    const ordered = container.querySelectorAll('ol');
    expect(unordered).toHaveLength(1);
    expect(ordered).toHaveLength(1);
    expect(unordered[0].querySelectorAll('li')).toHaveLength(2);
    expect(ordered[0].querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('加粗').tagName).toBe('STRONG');
    expect(screen.getByText('code').tagName).toBe('CODE');
    const citations = container.querySelectorAll('.cite');
    expect(citations).toHaveLength(2);
    expect(citations[0]).toHaveAttribute('title', '引用 1');
    expect(citations[1]).toHaveTextContent('12');
    const link = screen.getByRole('link', { name: '示例' });
    expect(link).toHaveAttribute('href', 'https://example.com/a');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('空内容渲染空容器，未识别语法按文本保留', () => {
    const { container, rerender } = render(<MarkdownLite content="" />);
    expect(container.querySelector('.ai-md')?.childNodes).toHaveLength(0);

    rerender(<MarkdownLite content={'*不是列表*\n[未闭合'} />);
    expect(screen.getByText('*不是列表*')).toBeInTheDocument();
    expect(screen.getByText('[未闭合')).toBeInTheDocument();
  });
});
