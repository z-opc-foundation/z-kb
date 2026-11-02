import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMemberAuthorization,
  listMembers,
  updateMemberPermissions,
  updateMemberRoles,
  type AuthRole,
  type MemberAuthorization as MemberAuthorizationData,
  type OrgMember,
  type PermissionCatalogItem,
} from '@/services/identity';
import MemberAuthorization from './member-authorization';

vi.mock('@/services/identity', () => ({
  listMembers: vi.fn(),
  getMemberAuthorization: vi.fn(),
  updateMemberRoles: vi.fn(),
  updateMemberPermissions: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const roles: AuthRole[] = [
  { id: 1, roleCode: 'kb_admin', roleName: '知识库管理员', enabled: true },
  { id: 2, roleCode: 'kb_viewer', roleName: '知识库访客', enabled: true },
];

const catalog: PermissionCatalogItem[] = [
  { code: 'menu.space', name: '知识空间', type: 'MENU', typeCode: 1, order: 40 },
  {
    code: 'menu.kb',
    name: '知识库',
    type: 'MENU',
    typeCode: 1,
    parentCode: 'menu.space',
    order: 41,
  },
  {
    code: 'kb.create',
    name: '新建知识库',
    type: 'BUTTON',
    typeCode: 2,
    parentCode: 'menu.kb',
    order: 101,
  },
];

const members: OrgMember[] = [
  { staffId: 11, name: '张三', jobNumber: 'A001', roleCodes: ['kb_admin'] },
  { staffId: 12, name: '李四', jobNumber: 'A002', roleCodes: [] },
];

const authorization: MemberAuthorizationData = {
  staffId: 11,
  name: '张三',
  jobNumber: 'A001',
  roles: [roles[0]],
  rolePermittedCodes: ['menu.space', 'menu.kb'],
  directCodes: ['kb.create'],
  inheritedCodes: [{ code: 'menu.space', source: 'UNIT' }],
};

function renderPanel(props: Partial<Parameters<typeof MemberAuthorization>[0]> = {}) {
  return render(
    <MemberAuthorization
      roles={roles}
      catalog={catalog}
      catalogLoading={false}
      catalogError=""
      onReloadCatalog={vi.fn()}
      refreshTick={0}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.mocked(listMembers).mockResolvedValue(members);
  vi.mocked(getMemberAuthorization).mockResolvedValue(authorization);
  vi.mocked(updateMemberRoles).mockResolvedValue(undefined);
  vi.mocked(updateMemberPermissions).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MemberAuthorization', () => {
  it('成员加载中展示状态，加载完成后展示行内容与人数', async () => {
    let resolveMembers: (value: OrgMember[]) => void = () => {};
    vi.mocked(listMembers).mockReturnValue(
      new Promise<OrgMember[]>((resolve) => {
        resolveMembers = resolve;
      }),
    );
    const onCountChange = vi.fn();

    renderPanel({ onCountChange });

    expect(screen.getByText('正在读取成员…')).toBeInTheDocument();

    await act(async () => resolveMembers(members));

    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('工号 A001')).toBeInTheDocument();
    expect(screen.getByText('工号 A002')).toBeInTheDocument();
    expect(screen.getAllByText('知识库管理员').length).toBeGreaterThan(0);
    expect(screen.getByText('未绑定')).toBeInTheDocument();
    expect(screen.getByText('Apex 人员主数据 · 共 2 人')).toBeInTheDocument();
    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(2));
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(11));
  });

  it('无成员时展示机构空态', async () => {
    vi.mocked(listMembers).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText('机构下还没有成员')).toBeInTheDocument();
    expect(
      screen.getByText('成员来自 Apex 人员主数据，需先在 Apex 组织中心维护员工。'),
    ).toBeInTheDocument();
  });

  it('点击成员行切换右侧授权对象', async () => {
    vi.mocked(getMemberAuthorization).mockImplementation(async (staffId) =>
      staffId === 12
        ? { ...authorization, staffId: 12, name: '李四', jobNumber: 'A002' }
        : authorization,
    );
    renderPanel();
    await screen.findByText('张三');
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(11));

    fireEvent.click(screen.getByText('李四').closest('tr') as HTMLElement);

    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(12));
    expect(await screen.findByText('staffId 12')).toBeInTheDocument();
  });

  it('成员加载失败展示错误并可重试', async () => {
    vi.mocked(listMembers)
      .mockRejectedValueOnce(new Error('成员接口异常'))
      .mockResolvedValueOnce(members);
    renderPanel();

    expect(await screen.findByText('成员接口异常')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it('目录加载中与加载失败时工作台给出反馈，重试回调用父级刷新', async () => {
    const onReloadCatalog = vi.fn();
    const { rerender } = render(
      <MemberAuthorization
        roles={roles}
        catalog={catalog}
        catalogLoading
        catalogError=""
        onReloadCatalog={onReloadCatalog}
        refreshTick={0}
      />,
    );
    expect(screen.getByText('正在读取权限目录…')).toBeInTheDocument();

    rerender(
      <MemberAuthorization
        roles={roles}
        catalog={catalog}
        catalogLoading={false}
        catalogError="目录接口异常"
        onReloadCatalog={onReloadCatalog}
        refreshTick={0}
      />,
    );
    expect(screen.getByText('权限目录加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(onReloadCatalog).toHaveBeenCalledTimes(1);
  });

  it('关键字搜索走延迟请求并展示过滤结果', async () => {
    renderPanel();
    await screen.findByText('张三');

    fireEvent.change(screen.getByPlaceholderText('按姓名或工号搜索'), {
      target: { value: '李' },
    });

    await waitFor(() => expect(listMembers).toHaveBeenLastCalledWith('李'));
    expect((await screen.findAllByText('李四')).length).toBeGreaterThan(0);
  });

  it('搜索候选下拉选中成员后按工号精确过滤并切换右侧详情', async () => {
    vi.mocked(listMembers).mockImplementation(async (keyword) =>
      keyword === 'A002' ? [members[1]] : members,
    );
    renderPanel();
    await screen.findByText('张三');

    fireEvent.change(screen.getByPlaceholderText('按姓名或工号搜索'), {
      target: { value: '李' },
    });

    fireEvent.click(await screen.findByRole('option', { name: /李四/ }));

    await waitFor(() => expect(listMembers).toHaveBeenLastCalledWith('A002'));
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(12));
    expect(screen.getByPlaceholderText('按姓名或工号搜索')).toHaveValue('A002');
  });

  it('成员超过一页时分页展示，翻页后详情跟随当前页，搜索回到第一页', async () => {
    const many: OrgMember[] = Array.from({ length: 30 }, (_, index) => ({
      staffId: 100 + index,
      name: `成员${index + 1}`,
      jobNumber: `B${String(index + 1).padStart(3, '0')}`,
      roleCodes: [],
    }));
    vi.mocked(listMembers).mockResolvedValue(many);
    vi.mocked(getMemberAuthorization).mockImplementation(async (staffId) => ({
      ...authorization,
      staffId,
      name: `成员${staffId - 99}`,
    }));

    renderPanel();

    expect(await screen.findByText('工号 B001')).toBeInTheDocument();
    expect(screen.getByText('共 30 人 · 第 1 / 3 页')).toBeInTheDocument();
    expect(screen.getByText('工号 B012')).toBeInTheDocument();
    expect(screen.queryByText('工号 B013')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('共 30 人 · 第 2 / 3 页')).toBeInTheDocument();
    expect(screen.getByText('工号 B013')).toBeInTheDocument();
    expect(screen.queryByText('工号 B001')).toBeNull();
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(112));

    fireEvent.change(screen.getByPlaceholderText('按姓名或工号搜索'), {
      target: { value: '成员' },
    });
    await waitFor(() => expect(listMembers).toHaveBeenLastCalledWith('成员'));
    await waitFor(() => expect(screen.getByText('共 30 人 · 第 1 / 3 页')).toBeInTheDocument());
  });
});
