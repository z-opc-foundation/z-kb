import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMemberAuthorization,
  updateMemberPermissions,
  updateMemberRoles,
  type AuthRole,
  type MemberAuthorization,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';
import MemberDetail from './member-detail';

vi.mock('@/services/identity', () => ({
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
  {
    code: 'kb.delete',
    name: '删除知识库',
    type: 'BUTTON',
    typeCode: 2,
    parentCode: 'menu.kb',
    order: 103,
  },
];

const authorization: MemberAuthorization = {
  staffId: 11,
  name: '张三',
  jobNumber: 'A001',
  roles: [roles[0]],
  rolePermittedCodes: ['menu.space', 'menu.kb'],
  directCodes: ['kb.create'],
  inheritedCodes: [{ code: 'menu.space', source: 'UNIT' }],
};

function treeNode(label: string): HTMLElement {
  const node = screen.getByText(label).closest('.ant-tree-treenode');
  if (!node) {
    throw new Error(`未找到树节点 ${label}`);
  }
  return node as HTMLElement;
}

function treeCheckbox(label: string): HTMLElement {
  const checkbox = treeNode(label).querySelector('.ant-tree-checkbox');
  if (!checkbox) {
    throw new Error(`未找到树节点复选框 ${label}`);
  }
  return checkbox as HTMLElement;
}

function renderDetail(props: Partial<Parameters<typeof MemberDetail>[0]> = {}) {
  const onSaved = vi.fn();
  render(
    <MemberDetail
      staffId={11}
      roles={roles}
      catalog={catalog}
      onSaved={onSaved}
      {...props}
    />,
  );
  return { onSaved };
}

/** 等待成员数据与初始勾选状态都写入后再交互，避免拿到首帧空选中。 */
async function waitForAuthorizationApplied() {
  await screen.findByText('张三');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '知识库管理员' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
  await waitFor(() =>
    expect(treeCheckbox('新建知识库')).toHaveClass('ant-tree-checkbox-checked'),
  );
}

beforeEach(() => {
  vi.mocked(getMemberAuthorization).mockResolvedValue(authorization);
  vi.mocked(updateMemberRoles).mockResolvedValue(undefined);
  vi.mocked(updateMemberPermissions).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MemberDetail', () => {
  it('加载中展示状态，成功后展示成员、角色与权限来源统计', async () => {
    let resolveData: (value: MemberAuthorization) => void = () => {};
    vi.mocked(getMemberAuthorization).mockReturnValue(
      new Promise<MemberAuthorization>((resolve) => {
        resolveData = resolve;
      }),
    );
    renderDetail();

    expect(screen.getByText('正在读取成员授权…')).toBeInTheDocument();
    expect(getMemberAuthorization).toHaveBeenCalledWith(11);

    await act(async () => resolveData(authorization));

    await waitForAuthorizationApplied();

    expect(screen.getByText('工号 A001')).toBeInTheDocument();
    expect(screen.getByText('staffId 11')).toBeInTheDocument();
    expect(screen.getByText(/直接 1 · 角色带入 2 · 组织岗位 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识库访客' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('角色与组织带入的权限只读，只有直接授权可勾选', async () => {
    renderDetail();
    await waitForAuthorizationApplied();
    await screen.findByText('新建知识库');

    expect(treeCheckbox('知识空间')).toHaveClass('ant-tree-checkbox-disabled');
    expect(treeCheckbox('知识库')).toHaveClass('ant-tree-checkbox-disabled');
    expect(treeCheckbox('新建知识库')).not.toHaveClass('ant-tree-checkbox-disabled');
    expect(treeCheckbox('删除知识库')).not.toHaveClass('ant-tree-checkbox-disabled');
    expect(screen.getAllByText('直接').length).toBeGreaterThan(0);
    expect(screen.getAllByText('角色').length).toBeGreaterThan(0);
    expect(screen.getAllByText('组织').length).toBeGreaterThan(0);
  });

  it('新增角色后保存，按角色编码提交并刷新授权', async () => {
    const { onSaved } = renderDetail();
    await waitForAuthorizationApplied();

    fireEvent.click(screen.getByRole('button', { name: '知识库访客' }));
    const save = screen.getByRole('button', { name: '保存角色' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateMemberRoles).toHaveBeenCalledWith(11, ['kb_admin', 'kb_viewer']),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      '角色已保存',
      '2 个角色绑定到该成员',
      'success',
    );
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledTimes(2));
  });

  it('取消已绑定角色后可还原并提交空角色列表', async () => {
    renderDetail();
    await waitForAuthorizationApplied();

    fireEvent.click(screen.getByRole('button', { name: '知识库管理员' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '知识库管理员' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(screen.getByRole('button', { name: '保存角色' })).not.toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: '还原' })[0]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存角色' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: '知识库管理员' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('勾选新的直接权限后保存增量变更', async () => {
    const { onSaved } = renderDetail();
    await waitForAuthorizationApplied();

    fireEvent.click(treeCheckbox('删除知识库'));
    const save = screen.getByRole('button', { name: '保存权限' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateMemberPermissions).toHaveBeenCalledWith(11, {
        addCodes: ['kb.delete'],
        removeCodes: [],
      }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('权限已保存', '新增 1 · 回收 0', 'success');
  });

  it('取消直接权限后保存回收编码', async () => {
    renderDetail();
    await waitForAuthorizationApplied();

    fireEvent.click(treeCheckbox('新建知识库'));
    const save = screen.getByRole('button', { name: '保存权限' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateMemberPermissions).toHaveBeenCalledWith(11, {
        addCodes: [],
        removeCodes: ['kb.create'],
      }),
    );
  });

  it('授权读取失败展示错误，重试后恢复', async () => {
    vi.mocked(getMemberAuthorization)
      .mockRejectedValueOnce(new Error('授权接口异常'))
      .mockResolvedValueOnce(authorization);
    renderDetail();

    expect(await screen.findByText('成员授权读取失败')).toBeInTheDocument();
    expect(screen.getByText('授权接口异常')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(getMemberAuthorization).toHaveBeenCalledTimes(2);
  });

  it('角色保存失败与权限保存失败分别提示错误', async () => {
    vi.mocked(updateMemberRoles).mockRejectedValueOnce(new Error('角色接口异常'));
    vi.mocked(updateMemberPermissions).mockRejectedValueOnce(new Error('权限接口异常'));
    renderDetail();
    await waitForAuthorizationApplied();

    fireEvent.click(screen.getByRole('button', { name: '知识库访客' }));
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('角色保存失败', '角色接口异常', 'error'),
    );

    fireEvent.click(treeCheckbox('删除知识库'));
    const savePermission = screen.getByRole('button', { name: '保存权限' });
    await waitFor(() => expect(savePermission).not.toBeDisabled());
    fireEvent.click(savePermission);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('权限保存失败', '权限接口异常', 'error'),
    );
  });

  it('无角色与空目录时展示引导文案', async () => {
    vi.mocked(getMemberAuthorization).mockResolvedValue({
      ...authorization,
      roles: [],
      rolePermittedCodes: [],
      directCodes: [],
      inheritedCodes: [],
    });
    renderDetail({ roles: [], catalog: [] });

    expect(
      await screen.findByText('当前机构还没有角色，可先去「角色授权」新建。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('权限目录为空，请先在「权限目录」发布。'),
    ).toBeInTheDocument();
  });
});
