import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth';
import type { AuthContext } from '@/services/identity';
import { fetchAuthContext } from '@/services/identity';
import { pageKnowledgeBase } from '@/services/knowledgeBase';
import RouteAccess from './route-access';

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn(),
}));
vi.mock('@/services/knowledgeBase', () => ({
  pageKnowledgeBase: vi.fn(),
  getKnowledgeBase: vi.fn(),
}));

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    authenticated: true,
    enforced: true,
    roles: [],
    permissions: [],
    menuCodes: [],
    menus: [],
    ...overrides,
  };
}

function LocationIndicator() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

function renderAccess(menuCode?: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/index" element={<div>首页内容</div>} />
          <Route
            path="*"
            element={
              <RouteAccess menuCode={menuCode}>
                <div>受保护内容</div>
              </RouteAccess>
            }
          />
        </Routes>
        <LocationIndicator />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAuthContext).mockResolvedValue(null);
  vi.mocked(pageKnowledgeBase).mockResolvedValue({
    records: [],
    total: 0,
    size: 1,
    current: 1,
  });
});

afterEach(() => {
  cleanup();
});

describe('路由菜单校验', () => {
  it('权限加载中显示占位', () => {
    vi.mocked(fetchAuthContext).mockReturnValue(new Promise(() => {}));
    renderAccess('menu.kb');

    expect(screen.getByRole('status', { name: '权限加载中' })).toBeInTheDocument();
    expect(screen.queryByText('受保护内容')).toBeNull();
  });

  it('强制期未授权时展示无权限说明并可返回首页', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(context({ menuCodes: [] }));
    const { container } = renderAccess('menu.kb');

    expect(await screen.findByText('没有访问权限')).toBeInTheDocument();
    expect(screen.getByText(/「menu.kb」的菜单授权/)).toBeInTheDocument();
    expect(screen.queryByText('受保护内容')).toBeNull();
    expect(container.querySelector('.sidebar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    expect(screen.getByText('首页内容')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/index');
  });

  it('点击重新校验会再拉一次权限视图', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(context({ menuCodes: [] }));
    renderAccess('menu.admin.audit');

    fireEvent.click(await screen.findByRole('button', { name: /重新校验/ }));

    await waitFor(() => expect(fetchAuthContext).toHaveBeenCalledTimes(2));
  });

  it('已授权时渲染页面内容', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(
      context({ menuCodes: ['menu.kb'] }),
    );
    renderAccess('menu.kb');

    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(screen.queryByText('没有访问权限')).toBeNull();
  });

  it('未配置菜单编码时不校验', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue(context({ menuCodes: [] }));
    renderAccess();

    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
  });
});
