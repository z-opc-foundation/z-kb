import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRolePermissions,
  updateRolePermissions,
  type AuthRole,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';
import RolePermissions from './role-permissions';

vi.mock('@/services/identity', () => ({
  getRolePermissions: vi.fn(),
  updateRolePermissions: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const role: AuthRole = {
  id: 7,
  roleCode: 'kb_admin',
  roleName: '知识库管理员',
  enabled: true,
};

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

const granted = ['menu.space', 'menu.kb', 'kb.create'];

function treeCheckbox(label: string): HTMLElement {
  const node = screen.getByText(label).closest('.ant-tree-treenode');
  const checkbox = node?.querySelector('.ant-tree-checkbox');
  if (!checkbox) {
    throw new Error(`未找到树节点复选框 ${label}`);
  }
  return checkbox as HTMLElement;
}

function renderPanel(props: Partial<Parameters<typeof RolePermissions>[0]> = {}) {
  return render(
    <RolePermissions role={role} catalog={catalog} {...props} />,
  );
}

beforeEach(() => {
  vi.mocked(getRolePermissions).mockResolvedValue(granted);
  vi.mocked(updateRolePermissions).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RolePermissions', () => {
  it('没有 Apex 角色 ID 时只展示提示，不请求权限', () => {
    renderPanel({ role: { ...role, id: undefined } });

    expect(screen.getByText('该角色没有 Apex 角色 ID')).toBeInTheDocument();
    expect(getRolePermissions).not.toHaveBeenCalled();
  });

  it('加载中展示状态，完成后展示已授予数量与勾选树', async () => {
    let resolvePermissions: (value: string[]) => void = () => {};
    vi.mocked(getRolePermissions).mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolvePermissions = resolve;
      }),
    );
    renderPanel();

    expect(screen.getByText('正在读取角色授权…')).toBeInTheDocument();
    expect(getRolePermissions).toHaveBeenCalledWith(7);

    resolvePermissions(granted);

    expect(await screen.findByText(/目录 4 项/)).toBeInTheDocument();
    await waitFor(() =>
      expect(treeCheckbox('新建知识库')).toHaveClass('ant-tree-checkbox-checked'),
    );
    expect(treeCheckbox('删除知识库')).not.toHaveClass('ant-tree-checkbox-checked');
    expect(screen.getByRole('button', { name: '保存授权' })).toBeDisabled();
  });

  it('勾选新权限后保存增量变更', async () => {
    renderPanel();
    await screen.findByText(/目录 4 项/);

    fireEvent.click(treeCheckbox('删除知识库'));
    expect(screen.getByText(/待提交：新增 1 · 回收 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存授权' }));

    await waitFor(() =>
      expect(updateRolePermissions).toHaveBeenCalledWith(7, {
        addCodes: ['kb.delete'],
        removeCodes: [],
      }),
    );
    expect(toast).toHaveBeenCalledWith('授权已保存', '新增 1 · 回收 0', 'success');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存授权' })).toBeDisabled());
  });

  it('取消已有权限后保存回收编码，还原可撤销改动', async () => {
    renderPanel();
    await screen.findByText(/目录 4 项/);

    fireEvent.click(treeCheckbox('新建知识库'));
    expect(screen.getByText(/待提交：新增 0 · 回收 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '还原' }));
    await waitFor(() =>
      expect(treeCheckbox('新建知识库')).toHaveClass('ant-tree-checkbox-checked'),
    );
    expect(screen.getByRole('button', { name: '保存授权' })).toBeDisabled();

    fireEvent.click(treeCheckbox('新建知识库'));
    fireEvent.click(screen.getByRole('button', { name: '保存授权' }));
    await waitFor(() =>
      expect(updateRolePermissions).toHaveBeenCalledWith(7, {
        addCodes: [],
        removeCodes: ['kb.create'],
      }),
    );
  });

  it('权限加载失败展示错误并禁用保存', async () => {
    vi.mocked(getRolePermissions).mockRejectedValueOnce(new Error('权限接口异常'));
    renderPanel();

    expect(await screen.findByText('授权读取失败')).toBeInTheDocument();
    expect(screen.getByText('权限接口异常')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存授权' })).toBeDisabled();
  });

  it('保存失败提示错误并结束保存状态', async () => {
    vi.mocked(updateRolePermissions).mockRejectedValueOnce(new Error('Apex 不可用'));
    renderPanel();
    await screen.findByText(/目录 4 项/);

    fireEvent.click(treeCheckbox('删除知识库'));
    fireEvent.click(screen.getByRole('button', { name: '保存授权' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('授权保存失败', 'Apex 不可用', 'error'),
    );
    expect(screen.getByRole('button', { name: '保存授权' })).not.toHaveTextContent(
      '保存中…',
    );
  });

  it('权限目录为空时提示先发布目录', async () => {
    renderPanel({ catalog: [] });

    expect(
      await screen.findByText('权限目录为空，请先发布目录'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });
});
