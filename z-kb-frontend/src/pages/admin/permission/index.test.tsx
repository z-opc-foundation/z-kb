import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth';
import {
  getMemberAuthorization,
  listMembers,
  listPermissionCatalog,
  listRoles,
  updateMemberPermissions,
  updateMemberRoles,
} from '@/services/identity';
import PermissionAdminPage from './index';

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn().mockResolvedValue(null),
  checkPermission: vi.fn().mockResolvedValue(true),
  listRoles: vi.fn(),
  saveRole: vi.fn(),
  changeRoleStatus: vi.fn(),
  getRolePermissions: vi.fn().mockResolvedValue([]),
  updateRolePermissions: vi.fn(),
  listMembers: vi.fn(),
  getMemberAuthorization: vi.fn(),
  updateMemberRoles: vi.fn(),
  updateMemberPermissions: vi.fn(),
  listPermissionCatalog: vi.fn(),
  publishPermissionCatalog: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const roles = [
  { id: 1, roleCode: 'kb_admin', roleName: '知识库管理员', enabled: true },
  { id: 2, roleCode: 'kb_viewer', roleName: '知识库访客', enabled: true },
];

const catalog = [
  { code: 'menu.space', name: '知识空间', type: 'MENU' as const, typeCode: 1, order: 40 },
  {
    code: 'menu.kb',
    name: '知识库',
    type: 'MENU' as const,
    typeCode: 1,
    parentCode: 'menu.space',
    order: 41,
  },
  {
    code: 'kb.create',
    name: '新建知识库',
    type: 'BUTTON' as const,
    typeCode: 2,
    parentCode: 'menu.kb',
    order: 101,
  },
];

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <PermissionAdminPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listRoles).mockResolvedValue(roles);
  vi.mocked(listPermissionCatalog).mockResolvedValue(catalog);
  vi.mocked(listMembers).mockResolvedValue([
    { staffId: 11, name: '张三', jobNumber: 'A001', roleCodes: ['kb_admin'] },
    { staffId: 12, name: '李四', jobNumber: 'A002', roleCodes: [] },
  ]);
  vi.mocked(getMemberAuthorization).mockResolvedValue({
    staffId: 11,
    name: '张三',
    jobNumber: 'A001',
    roles: [roles[0]],
    rolePermittedCodes: ['menu.space', 'menu.kb'],
    directCodes: ['kb.create'],
    inheritedCodes: [{ code: 'menu.space', source: 'UNIT' }],
  });
  vi.mocked(updateMemberRoles).mockResolvedValue(undefined);
  vi.mocked(updateMemberPermissions).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('权限管理页', () => {
  it('默认展示角色授权，可在三页签间切换', async () => {
    renderPage();

    expect((await screen.findAllByText('知识库管理员')).length).toBeGreaterThan(0);
    expect(screen.getByText('知识库访客')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /权限目录/ }));
    expect(await screen.findByRole('button', { name: /发布权限目录/ })).toBeInTheDocument();
    expect(await screen.findByText('kb.create')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /成员授权/ }));
    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(listMembers).toHaveBeenCalled();
    await waitFor(() => expect(getMemberAuthorization).toHaveBeenCalledWith(11));
  });

  it('成员授权展示可编辑的直接授权与只读的角色/组织带入项', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /成员授权/ }));

    expect(await screen.findByText(/直接 1 · 角色带入 2 · 组织岗位 1/)).toBeInTheDocument();
    // 左侧成员表与右侧 chips 都会出现角色名，只在右侧 chip（button）里断言
    expect(
      screen.getAllByRole('button', { name: '知识库管理员' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('组织')).toBeInTheDocument();
  });

  it('切换角色后保存走成员角色接口', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /成员授权/ }));
    await screen.findByText(/直接 1 · 角色带入 2/);

    fireEvent.click(screen.getByRole('button', { name: '知识库管理员' }));
    fireEvent.click(screen.getByRole('button', { name: '知识库访客' }));
    const save = screen.getByRole('button', { name: '保存角色' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateMemberRoles).toHaveBeenCalledWith(11, ['kb_viewer']),
    );
  });
});
