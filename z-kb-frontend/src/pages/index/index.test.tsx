import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderAt } from '@/test/render';
import IndexPage from './index';

afterEach(() => {
  cleanup();
});

describe('IndexPage', () => {
  it('展示三个入口卡片及去向链接', () => {
    renderAt(<IndexPage />);

    const knowledge = screen.getByRole('link', { name: /知识库/ });
    expect(knowledge).toHaveAttribute('href', '/knowledge-bases');
    expect(knowledge).toHaveTextContent('查看本租户的知识库，管理资料、Wiki、图谱与检索。');

    expect(screen.getByRole('link', { name: /评测/ })).toHaveAttribute(
      'href',
      '/evaluations',
    );
    expect(screen.getByRole('link', { name: /智能管理/ })).toHaveAttribute(
      'href',
      '/ai/agents',
    );
  });

  it('入口卡片使用三列网格容器', () => {
    const { container } = renderAt(<IndexPage />);

    expect(container.querySelector('.grid.grid-3')).toBeInTheDocument();
    expect(container.querySelectorAll('a.panel')).toHaveLength(3);
  });
});
