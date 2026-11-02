import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/services/identity';
import { fetchAuthContext } from '@/services/identity';
import { AuthProvider, Can, usePermission } from './index';

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn(),
}));

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    authenticated: true,
    enforced: true,
    name: '张三',
    roles: [],
    permissions: [],
    menuCodes: [],
    menus: [],
    ...overrides,
  };
}

function Probe() {
  const permission = usePermission();
  return (
    <div>
      <span data-testid="state">
        {permission.loading
          ? 'loading'
          : `${permission.context?.name ?? '-'}|${permission.enforced}|${permission.can(
              'kb.create',
            )}|${permission.canSeeMenu('menu.kb')}`}
      </span>
      <button type="button" onClick={permission.reload}>
        重新加载
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAuthContext).mockResolvedValue(null);
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('加载权限视图后暴露角色、强制期与权限判断', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(
      context({ permissions: ['kb.create'], menuCodes: ['menu.kb'] }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('张三|true|true|true'),
    );
    expect(fetchAuthContext).toHaveBeenCalledOnce();
  });

  it('权限视图为空时按放行处理', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('-|false|true|true'),
    );
  });

  it('重新加载会再次拉取权限视图', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(fetchAuthContext).toHaveBeenCalledOnce());

    act(() => screen.getByRole('button', { name: '重新加载' }).click());
    await waitFor(() => expect(fetchAuthContext).toHaveBeenCalledTimes(2));
  });

  it('独立导览页不拉权限，进入控制台后再补拉', async () => {
    window.history.replaceState(null, '', '/#/welcome');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('-|false|true|true'),
    );
    expect(fetchAuthContext).not.toHaveBeenCalled();

    act(() => {
      window.location.hash = '#/index';
    });
    await waitFor(() => expect(fetchAuthContext).toHaveBeenCalledOnce());
  });

  it('脱离 Provider 使用时明确报错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('usePermission 必须在 AuthProvider 内使用');
  });
});

describe('Can 按钮权限包装', () => {
  it('有权限渲染内容，无权限渲染兜底', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(
      context({ permissions: ['kb.create'] }),
    );

    render(
      <AuthProvider>
        <Can code="kb.create">
          <button type="button">新建</button>
        </Can>
        <Can code="kb.delete" fallback={<span>无删除权限</span>}>
          <button type="button">删除</button>
        </Can>
      </AuthProvider>,
    );

    expect(await screen.findByRole('button', { name: '新建' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
    expect(screen.getByText('无删除权限')).toBeInTheDocument();
  });
});
