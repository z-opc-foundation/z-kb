import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import {
  changeRoleStatus,
  checkPermission,
  fetchAuthContext,
  getMemberAuthorization,
  getRolePermissions,
  listMembers,
  listPermissionCatalog,
  listRoles,
  publishPermissionCatalog,
  saveRole,
  updateMemberPermissions,
  updateMemberRoles,
  updateRolePermissions,
} from './identity';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/identity';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('登录权限视图接口', () => {
  it('读取权限视图时静默并携带租户头', async () => {
    const context = { authenticated: true, enforced: true, roles: [], permissions: [], menuCodes: [], menus: [] };
    vi.mocked(request).mockResolvedValueOnce(context as never);
    await expect(fetchAuthContext()).resolves.toBe(context);
    expect(request).toHaveBeenCalledWith(`${BASE}/auth/context`, {
      silent: true,
      headers,
    });
  });

  it('读取权限视图失败时按放行返回 null', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('401'));
    await expect(fetchAuthContext()).resolves.toBeNull();
  });

  it('校验权限点并编码查询参数', async () => {
    vi.mocked(request).mockResolvedValueOnce({ code: 'kb.create', allowed: true } as never);
    await expect(checkPermission('kb.create')).resolves.toBe(true);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/auth/check?code=kb.create`, {
      silent: true,
      headers,
    });

    vi.mocked(request).mockResolvedValueOnce({ code: 'a b/c', allowed: false } as never);
    await expect(checkPermission('a b/c')).resolves.toBe(false);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/auth/check?code=a%20b%2Fc`, {
      silent: true,
      headers,
    });

    vi.mocked(request).mockResolvedValueOnce(undefined as never);
    await expect(checkPermission('x')).resolves.toBe(false);
  });
});

describe('角色与权限目录接口', () => {
  it('角色列表与关键字查询', async () => {
    await listRoles();
    expect(request).toHaveBeenLastCalledWith(`${BASE}/roles`, { headers });

    await listRoles('管理员 角色');
    expect(request).toHaveBeenLastCalledWith(
      `${BASE}/roles?keyword=${encodeURIComponent('管理员 角色')}`,
      { headers },
    );
  });

  it('保存角色、切换状态、读取与更新权限', async () => {
    await saveRole({ roleCode: 'r1', roleName: '角色' });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/roles/save`, {
      method: 'POST',
      data: { roleCode: 'r1', roleName: '角色' },
      headers,
    });

    await changeRoleStatus([1, 2], false);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/roles/status`, {
      method: 'POST',
      data: { ids: [1, 2], enabled: false },
      headers,
    });

    await getRolePermissions(3);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/roles/3/permissions`, { headers });

    const change = { addCodes: ['a'], removeCodes: ['b'] };
    await updateRolePermissions(3, change);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/roles/3/permissions`, {
      method: 'POST',
      data: change,
      headers,
    });
  });

  it('权限目录读取与发布', async () => {
    await listPermissionCatalog();
    expect(request).toHaveBeenLastCalledWith(`${BASE}/catalog`, { headers });

    vi.mocked(request).mockResolvedValueOnce({ published: 7 } as never);
    await expect(publishPermissionCatalog()).resolves.toBe(7);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/catalog/publish`, {
      method: 'POST',
      headers,
    });

    vi.mocked(request).mockResolvedValueOnce(undefined as never);
    await expect(publishPermissionCatalog()).resolves.toBe(0);
  });
});

describe('成员授权接口', () => {
  it('成员列表支持关键字与静默选项', async () => {
    await listMembers();
    expect(request).toHaveBeenLastCalledWith(`${BASE}/members`, {
      headers,
      silent: undefined,
    });

    await listMembers('张三', { silent: true });
    expect(request).toHaveBeenLastCalledWith(
      `${BASE}/members?keyword=${encodeURIComponent('张三')}`,
      { headers, silent: true },
    );
  });

  it('读取并更新成员角色与直接权限', async () => {
    await getMemberAuthorization(9);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/members/9/authorization`, { headers });

    await updateMemberRoles(9, ['r1', 'r2']);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/members/9/roles`, {
      method: 'POST',
      data: { roleCodes: ['r1', 'r2'] },
      headers,
    });

    const change = { addCodes: ['p1'], removeCodes: [] };
    await updateMemberPermissions(9, change);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/members/9/permissions`, {
      method: 'POST',
      data: change,
      headers,
    });
  });
});
