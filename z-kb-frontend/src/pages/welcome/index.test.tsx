import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { renderAt } from '@/test/render';
import WelcomePage from './index';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.search}</span>;
}

function renderWelcome(route = '/welcome') {
  return renderAt(
    <>
      <WelcomePage />
      <LocationProbe />
    </>,
    { route },
  );
}

afterEach(() => {
  cleanup();
});

describe('WelcomePage', () => {
  it('默认展示开始使用主题与入口统计', () => {
    renderWelcome();

    expect(screen.getAllByRole('tab')).toHaveLength(12);
    expect(screen.getByRole('tab', { name: '开始使用' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '第一次用，先走通这四步' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 个主题')).toBeInTheDocument();
    expect(screen.getByText('4 步')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /去建第一个库/ })).toHaveAttribute(
      'href',
      '/knowledge-bases',
    );
  });

  it('?tab= 深链直接打开常见问题主题', () => {
    renderWelcome('/welcome?tab=faq');

    expect(screen.getByRole('tab', { name: '常见问题' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '常见问题' }),
    ).toBeInTheDocument();
    expect(screen.getByText('资料上传了，却没法发起整理')).toBeInTheDocument();
    expect(screen.queryByText('怎么做')).not.toBeInTheDocument();
  });

  it('点击页签切换主题并同步 ?tab= 查询参数', async () => {
    renderWelcome();

    fireEvent.click(screen.getByRole('tab', { name: '新建知识库' }));

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '建库前先想清楚：这个库里放什么',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '新建知识库' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('?tab=create'),
    );

    fireEvent.click(screen.getByRole('tab', { name: '开始使用' }));
    await waitFor(() => expect(screen.getByTestId('location')).toBeEmptyDOMElement());
  });

  it('帮助入口链接到常见问题主题', async () => {
    renderWelcome();

    const topHelp = screen
      .getAllByRole('link', { name: '常见问题' })
      .find((link) => link.getAttribute('href') === '/welcome?tab=faq');
    expect(topHelp).toBeDefined();
    const consoleLinks = screen.getAllByRole('link', { name: '返回控制台' });
    expect(consoleLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of consoleLinks) {
      expect(link).toHaveAttribute('href', '/index');
    }

    fireEvent.click(topHelp as HTMLElement);

    expect(
      await screen.findByRole('heading', { level: 2, name: '常见问题' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=faq');
  });

  it('未知 tab 回退到开始使用主题', () => {
    renderWelcome('/welcome?tab=unknown');

    expect(screen.getByRole('tab', { name: '开始使用' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '第一次用，先走通这四步' }),
    ).toBeInTheDocument();
  });
});
