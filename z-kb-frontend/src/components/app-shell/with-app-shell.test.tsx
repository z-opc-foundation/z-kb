import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withAppShell } from './with-app-shell';

vi.mock('@/components/app-shell', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

afterEach(cleanup);

describe('withAppShell', () => {
  it('把页面包裹进知识中台外壳', () => {
    function DemoPage() {
      return <div>页面内容</div>;
    }
    const Wrapped = withAppShell(DemoPage);

    render(<Wrapped />);

    const shell = screen.getByTestId('app-shell');
    expect(shell).toContainElement(screen.getByText('页面内容'));
  });

  it('每次调用返回新的包装组件', () => {
    function DemoPage() {
      return null;
    }
    expect(withAppShell(DemoPage)).not.toBe(withAppShell(DemoPage));
  });
});
