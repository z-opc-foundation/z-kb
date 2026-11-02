import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPermissionCatalog,
  listRoles,
  publishPermissionCatalog,
  type AuthRole,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';
import { usePermissionAdmin } from './use-permission-admin';

vi.mock('@/services/identity', () => ({
  listRoles: vi.fn(),
  listPermissionCatalog: vi.fn(),
  publishPermissionCatalog: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const roles: AuthRole[] = [
  { id: 1, roleCode: 'kb_admin', roleName: '知识库管理员', enabled: true },
  { id: 2, roleCode: 'kb_viewer', roleName: '知识库访客', enabled: false },
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

beforeEach(() => {
  vi.mocked(listRoles).mockResolvedValue(roles);
  vi.mocked(listPermissionCatalog).mockResolvedValue(catalog);
  vi.mocked(publishPermissionCatalog).mockResolvedValue(3);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePermissionAdmin', () => {
  it('并行加载角色与权限目录，完成后释放 loading', async () => {
    const { result } = renderHook(() => usePermissionAdmin());

    expect(result.current.rolesLoading).toBe(true);
    expect(result.current.catalogLoading).toBe(true);

    await waitFor(() => expect(result.current.rolesLoading).toBe(false));
    await waitFor(() => expect(result.current.catalogLoading).toBe(false));

    expect(result.current.roles).toEqual(roles);
    expect(result.current.catalog).toEqual(catalog);
    expect(result.current.rolesError).toBe('');
    expect(result.current.catalogError).toBe('');
    expect(listRoles).toHaveBeenCalledWith(undefined);
    expect(listPermissionCatalog).toHaveBeenCalledTimes(1);
  });

  it('关键字延迟查询角色，reloadCatalog 触发目录重新加载', async () => {
    const { result } = renderHook(() => usePermissionAdmin());
    await waitFor(() => expect(result.current.rolesLoading).toBe(false));

    act(() => result.current.setKeyword(' 运营 '));
    await waitFor(() => expect(listRoles).toHaveBeenLastCalledWith('运营'));

    act(() => result.current.reloadCatalog());
    await waitFor(() => expect(listPermissionCatalog).toHaveBeenCalledTimes(2));
  });

  it('角色与目录加载失败分别记录错误', async () => {
    vi.mocked(listRoles).mockRejectedValueOnce(new Error('角色服务异常'));
    vi.mocked(listPermissionCatalog).mockRejectedValueOnce(new Error('目录服务异常'));

    const { result } = renderHook(() => usePermissionAdmin());

    await waitFor(() => expect(result.current.rolesError).toBe('角色服务异常'));
    await waitFor(() => expect(result.current.catalogError).toBe('目录服务异常'));
    expect(result.current.rolesLoading).toBe(false);
    expect(result.current.catalogLoading).toBe(false);
  });

  it('applyRole 只替换同编码角色，保持列表顺序', async () => {
    const { result } = renderHook(() => usePermissionAdmin());
    await waitFor(() => expect(result.current.roles).toEqual(roles));

    act(() => result.current.applyRole({ ...roles[1], enabled: true }));

    expect(result.current.roles.map((role) => role.enabled)).toEqual([true, true]);
    expect(result.current.roles[1].roleName).toBe('知识库访客');
  });

  it('发布目录成功提示数量并刷新目录', async () => {
    const { result } = renderHook(() => usePermissionAdmin());
    await waitFor(() => expect(result.current.catalogLoading).toBe(false));

    await act(async () => {
      await result.current.publishCatalog();
    });

    expect(publishPermissionCatalog).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      '权限目录已发布',
      '共 3 个菜单与按钮同步到 Apex',
      'success',
    );
    expect(result.current.publishing).toBe(false);
    expect(listPermissionCatalog).toHaveBeenCalledTimes(2);
  });

  it('发布失败提示错误信息并结束 publishing', async () => {
    vi.mocked(publishPermissionCatalog).mockRejectedValueOnce(new Error('Apex 不可用'));
    const { result } = renderHook(() => usePermissionAdmin());
    await waitFor(() => expect(result.current.catalogLoading).toBe(false));

    await act(async () => {
      await result.current.publishCatalog();
    });

    expect(toast).toHaveBeenCalledWith('发布失败', 'Apex 不可用', 'error');
    expect(result.current.publishing).toBe(false);
    expect(listPermissionCatalog).toHaveBeenCalledTimes(1);
  });
});
