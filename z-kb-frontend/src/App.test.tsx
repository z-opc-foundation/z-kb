import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { AuthProvider } from '@/components/auth';
import { allRoutes, defaultRoutePath } from '@/routes';
import { getKnowledgeBase, pageKnowledgeBase } from '@/services/knowledgeBase';
import { fetchAuthContext } from '@/services/identity';
import AppShell from '@/components/app-shell';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { KB_CHANGED_EVENT } from '@/utils/kb-events';
import { DEFAULT_TENANT_CODE } from '@/utils/tenant';
import { toast } from '@/utils/toast';

vi.mock('@/services/knowledgeBase', () => ({
  pageKnowledgeBase: vi.fn(),
  getKnowledgeBase: vi.fn(),
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
  archiveKnowledgeBase: vi.fn(),
  restoreKnowledgeBase: vi.fn(),
  removeKnowledgeBase: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn().mockResolvedValue(null),
  checkPermission: vi.fn().mockResolvedValue(true),
  listRoles: vi.fn().mockResolvedValue([]),
  saveRole: vi.fn(),
  changeRoleStatus: vi.fn(),
  getRolePermissions: vi.fn().mockResolvedValue([]),
  updateRolePermissions: vi.fn(),
  listMembers: vi.fn().mockResolvedValue([]),
  getMemberAuthorization: vi.fn(),
  updateMemberRoles: vi.fn(),
  updateMemberPermissions: vi.fn(),
  listPermissionCatalog: vi.fn().mockResolvedValue([]),
  publishPermissionCatalog: vi.fn().mockResolvedValue(0),
}));

function LocationIndicator() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="location">{pathname}{search}{hash}</output>;
}

function renderApp(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationIndicator />
      </MemoryRouter>
    </AuthProvider>,
  );
}

function renderShell(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/knowledge-bases/:kbId/*" element={<AppShell>测试内容</AppShell>} />
          <Route path="*" element={<AppShell>测试内容</AppShell>} />
        </Routes>
        <LocationIndicator />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAuthContext).mockResolvedValue(null);
  vi.mocked(pageKnowledgeBase).mockResolvedValue({ records: [], total: 0, size: 20, current: 1 });
  vi.mocked(getKnowledgeBase).mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('路由注册与默认落地', () => {
  it('注册首页与知识中台各页面路由', () => {
    expect(defaultRoutePath).toBe('/index');
    expect(allRoutes.map((route) => route.path)).toEqual([
      '/index',
      '/welcome',
      '/knowledge-bases',
      '/knowledge-bases/:kbId',
      '/knowledge-bases/:kbId/settings',
      '/knowledge-bases/:kbId/versions',
      '/evaluations',
      '/knowledge-bases/:kbId/evaluation',
      '/ai/agents',
      '/ai/skills',
      '/ai/tools',
      '/ai/monitor',
      '/ai/metrics',
      '/admin/monitor',
      '/admin/permission',
      '/admin/audit',
      '/admin/schedule',
      '/admin/task-config',
      '/admin/tenant',
      '/admin/quota',
      '/ontology',
      '/ontology-modeling',
      '/ontology-graph',
      '/knowledge-bases/:kbId/:tab',
    ]);
  });

  it.each(['/', '/unknown', '/workspace'])('从 %s 落地到知识中台首页', async (path) => {
    renderApp(path);
    expect(await screen.findByRole('link', { name: /查看本租户的知识库/ })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/index');
  });

  it.each(['/', '/unknown'])('从 %s 跳转时保留 query 和 hash', async (path) => {
    renderApp(`${path}?_from_login=1&source=demo#section`);
    await screen.findByRole('link', { name: /查看本租户的知识库/ });
    expect(screen.getByTestId('location')).toHaveTextContent('/index?_from_login=1&source=demo#section');
  });

  it('首页使用知识中台外壳，面包屑显示首页', async () => {
    const { container } = renderApp('/index');
    await screen.findByRole('link', { name: /查看本租户的知识库/ });
    expect(container.querySelector('.sidebar')).toBeInTheDocument();
    expect(container.querySelector('.topbar')).toBeInTheDocument();
    expect(container.querySelector('.crumbs .current')).toHaveTextContent('首页');
  });

  it('首页入口卡片可导航到知识库', async () => {
    renderApp('/index');
    fireEvent.click(await screen.findByRole('link', { name: /查看本租户的知识库/ }));
    await screen.findByPlaceholderText('搜索名称、编码、类型或嵌入模型');
    expect(screen.getByTestId('location')).toHaveTextContent('/knowledge-bases');
  });

  it('知识库列表使用知识中台外壳', async () => {
    const { container } = renderApp('/knowledge-bases');
    await screen.findByPlaceholderText('搜索名称、编码、类型或嵌入模型');
    expect(container.querySelector('.sidebar')).toBeInTheDocument();
    expect(container.querySelector('.topbar')).toBeInTheDocument();
  });
});

describe('Demo 外壳回归', () => {
  it.each(['/evaluations', '/evaluations/', '/knowledge-bases/kb-1/evaluation/'])(
    '%s 正确高亮评测入口', async (path) => {
      const { container } = renderShell(path);
      expect(await screen.findByRole('link', { name: '知识评测' })).toHaveClass('active');
      expect(container.querySelector('.crumbs .current')).toHaveTextContent('知识评测');
    },
  );

  it('知识库路径包含不完整编码时不会使外壳崩溃', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderShell('/knowledge-bases/%');
    expect(screen.getByText('测试内容')).toBeInTheDocument();
    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledWith('%'));
  });

  it('共用一次知识库变更订阅，刷新库名并清理监听', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderShell('/knowledge-bases/kb-1');
    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledOnce());
    const subscriptions = addListener.mock.calls.filter(([name]) => name === KB_CHANGED_EVENT);
    expect(subscriptions).toHaveLength(1);
    act(() => window.dispatchEvent(new Event(KB_CHANGED_EVENT)));
    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledTimes(2));
    expect(pageKnowledgeBase).not.toHaveBeenCalled();
    unmount();
    expect(removeListener).toHaveBeenCalledWith(KB_CHANGED_EVENT, subscriptions[0][1]);
  });

  it('命令搜索支持快捷键、筛选和页面导航', async () => {
    renderShell('/knowledge-bases');
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: '搜索知识库、页面或操作' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  评测  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /评测/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/evaluations'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('取消租户修改后再次打开时还原当前租户编码', async () => {
    renderShell('/knowledge-bases');
    fireEvent.click(screen.getByTitle('切换租户'));
    const dialog = screen.getByRole('dialog', { name: '切换租户' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'cancelled-tenant' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    fireEvent.click(screen.getByTitle('切换租户'));
    expect(within(screen.getByRole('dialog', { name: '切换租户' })).getByRole('textbox')).toHaveValue(DEFAULT_TENANT_CODE);
  });

  it('租户编码无法保存时提示失败并保留弹窗', async () => {
    renderShell('/knowledge-bases');
    fireEvent.click(screen.getByTitle('切换租户'));
    const dialog = screen.getByRole('dialog', { name: '切换租户' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'another-tenant' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('存储不可用'); });
    fireEvent.click(within(dialog).getByRole('button', { name: '切换' }));
    expect(toast).toHaveBeenCalledWith('切换租户失败', '无法保存租户编码，请检查浏览器存储设置', 'error');
    expect(dialog).toBeInTheDocument();
  });

  it('弹窗保持原有关闭交互并提供可访问名称', () => {
    const onClose = vi.fn();
    const { unmount } = render(<AppModal title="测试弹窗" sub="弹窗说明" body="内容" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: '测试弹窗' });
    expect(dialog).toHaveAccessibleDescription('弹窗说明');
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'constructor', 'toString', '__proto__'])('未知图标 %s 使用圆形兜底', (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('svg > circle')).toHaveAttribute('r', '9');
  });
});
