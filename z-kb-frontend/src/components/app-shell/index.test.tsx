import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth';
import { fetchAuthContext } from '@/services/identity';
import { getKnowledgeBase, pageKnowledgeBase } from '@/services/knowledgeBase';
import { logout, redirectToLogin } from '@/services/sso';
import { toast } from '@/utils/toast';
import AppShell from './index';

vi.mock('@/services/knowledgeBase', () => ({
  pageKnowledgeBase: vi.fn(),
  getKnowledgeBase: vi.fn(),
}));

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn(),
}));

vi.mock('@/services/sso', () => ({
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

function LocationIndicator() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

function renderShell(path = '/index') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/knowledge-bases/:kbId"
            element={
              <AppShell>
                <div>测试内容</div>
              </AppShell>
            }
          />
          <Route
            path="*"
            element={
              <AppShell>
                <div>测试内容</div>
              </AppShell>
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
  vi.mocked(getKnowledgeBase).mockResolvedValue(undefined);
  vi.mocked(logout).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.className = '';
});

describe('知识中台外壳', () => {
  it('渲染侧栏、顶栏与首页面包屑，侧栏不显示知识库数量角标', async () => {
    const { container } = renderShell('/index');

    expect(container.querySelector('.sidebar')).toBeInTheDocument();
    expect(container.querySelector('.topbar')).toBeInTheDocument();
    expect(container.querySelector('.nav-count')).not.toBeInTheDocument();
    expect(screen.getByText('首页')).toHaveClass('current');
    expect(screen.getByText('测试内容')).toBeInTheDocument();
    expect(pageKnowledgeBase).not.toHaveBeenCalled();
    expect(redirectToLogin).not.toHaveBeenCalled();

    const globalGroup = screen.getByText('全局管理').closest('.nav-group') as HTMLElement;
    expect(within(globalGroup).getByRole('link', { name: '租户管理' })).toHaveAttribute(
      'href',
      '/admin/tenant',
    );
    expect(within(globalGroup).getByRole('link', { name: '配额管理' })).toHaveAttribute(
      'href',
      '/admin/quota',
    );
  });

  it('强制鉴权时按菜单授权裁剪侧栏', async () => {
    vi.mocked(fetchAuthContext).mockResolvedValue({
      authenticated: true,
      enforced: true,
      roles: [],
      permissions: [],
      menuCodes: ['menu.kb'],
      menus: [],
    });
    renderShell('/index');

    await waitFor(() => expect(screen.queryByText('基础设施')).toBeNull());
    expect(screen.getByRole('link', { name: /知识管理/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '知识评测' })).toBeNull();
    expect(screen.queryByText('运营管理')).toBeNull();
    expect(screen.queryByText('全局管理')).toBeNull();
    expect(screen.queryByText('本体空间')).toBeNull();
  });

  it('全局管理入口可直接导航到租户与配额页面', async () => {
    const { container } = renderShell('/index');

    fireEvent.click(await screen.findByRole('link', { name: '租户管理' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/tenant'));
    expect(container.querySelector('.crumbs .current')).toHaveTextContent('租户管理');
    expect(screen.getByRole('link', { name: '租户管理' })).toHaveClass('active');

    fireEvent.click(screen.getByRole('link', { name: '配额管理' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/quota'));
    expect(container.querySelector('.crumbs .current')).toHaveTextContent('配额管理');
    expect(screen.getByRole('link', { name: '配额管理' })).toHaveClass('active');
  });

  it('折叠与展开菜单分组', async () => {
    renderShell('/index');
    await screen.findByRole('link', { name: /知识管理/ });

    fireEvent.click(screen.getByTitle('折叠 基础设施'));
    expect(screen.getByTitle('展开 基础设施')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTitle('展开 基础设施'));
    expect(screen.getByTitle('折叠 基础设施')).toHaveAttribute('aria-expanded', 'true');
  });

  it('顶栏按钮切换侧栏收起状态并触发通知提示', async () => {
    renderShell('/index');
    await screen.findByRole('link', { name: /知识管理/ });

    fireEvent.click(screen.getByTitle('收起/展开侧边栏'));
    expect(document.body).toHaveClass('sidebar-collapsed');

    const notify = screen.getByTitle('通知');
    expect(notify).toHaveClass('has-dot');
    fireEvent.click(notify);
    expect(toast).toHaveBeenCalledWith('没有新通知', '通知中心暂未上线', 'info');
    expect(notify).not.toHaveClass('has-dot');
  });

  it('知识库详情面包屑展示真实库名', async () => {
    vi.mocked(getKnowledgeBase).mockResolvedValue({
      kbId: 'kb-1',
      name: '测试知识库',
    } as never);
    const { container } = renderShell('/knowledge-bases/kb-1');

    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledWith('kb-1'));
    await waitFor(() =>
      expect(container.querySelector('.crumbs .current')).toHaveTextContent('测试知识库'),
    );
  });

  it('账号菜单可退出登录并走二次确认', async () => {
    renderShell('/index');

    const chip = await screen.findByTitle('账号与退出登录');
    fireEvent.click(chip);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('本地账号')).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /退出登录/ }));
    const dialog = await screen.findByRole('dialog', { name: '退出登录' });
    expect(dialog).toHaveAccessibleDescription('退出后需重新通过统一登录认证才能进入知识中台。');

    fireEvent.click(within(dialog).getByRole('button', { name: '退出登录' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('账号菜单支持 Esc 关闭', async () => {
    renderShell('/index');

    fireEvent.click(await screen.findByTitle('账号与退出登录'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('全局命令面板', () => {
  it('快捷键打开、无匹配提示并在回车后导航', async () => {
    renderShell('/index');

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: '搜索知识库、页面或操作' });
    const input = within(dialog).getByPlaceholderText('输入知识库、页面或操作名称');

    fireEvent.change(input, { target: { value: '不存在的页面' } });
    expect(within(dialog).getByText('没有匹配项')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '评测' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('location')).toHaveTextContent('/evaluations');
  });

  it('搜索按钮打开面板并支持 Esc 关闭', async () => {
    renderShell('/index');

    fireEvent.click(screen.getByRole('button', { name: /搜索知识库、页面或操作/ }));
    const dialog = await screen.findByRole('dialog', { name: '搜索知识库、页面或操作' });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
