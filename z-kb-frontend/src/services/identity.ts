import { getTenantCode } from '@/utils/tenant';
import { request } from './http';

/** 当前登录人的系统权限视图，与后端 /v1/identity/auth/context 对齐。 */
export interface AuthContext {
  principalId?: number;
  name?: string;
  authenticated: boolean;
  /** false 表示放行观察期：菜单全开，后端也不拦截 */
  enforced: boolean;
  roles: AuthRole[];
  permissions: string[];
  menuCodes: string[];
  menus: AuthMenuNode[];
}

export interface AuthRole {
  id?: number;
  roleCode: string;
  roleName: string;
  description?: string;
  type?: number;
  enabled: boolean;
}

export interface AuthMenuNode {
  code: string;
  name: string;
  path?: string;
  icon?: string;
  order: number;
  children: AuthMenuNode[];
  buttons: AuthMenuNode[];
}

/** 系统权限目录项（完整目录，不随登录人裁剪）。 */
export interface PermissionCatalogItem {
  code: string;
  name: string;
  type: 'MENU' | 'BUTTON';
  typeCode: number;
  parentCode?: string;
  path?: string;
  icon?: string;
  order: number;
}

export interface RoleSavePayload {
  id?: number;
  roleCode: string;
  roleName: string;
  description?: string;
  enabled?: boolean;
  type?: number;
}

export interface RolePermissionChange {
  addCodes: string[];
  removeCodes: string[];
}

/** Apex 人员主数据里的成员，角色为已绑定的角色编码。 */
export interface OrgMember {
  staffId: number;
  name?: string;
  jobNumber?: string;
  roleCodes: string[];
}

/** 组织 / 岗位继承到成员的权限点，只读。 */
export interface MemberInheritedPermission {
  code: string;
  source: 'UNIT' | 'POSITION';
}

export interface MemberAuthorization {
  staffId: number;
  name?: string;
  jobNumber?: string;
  roles: AuthRole[];
  /** 角色带入的权限编码 */
  rolePermittedCodes: string[];
  /** 直接授予成员的权限编码，可编辑 */
  directCodes: string[];
  inheritedCodes: MemberInheritedPermission[];
}

const BASE = '/future-brain/v1/identity';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

/** 读取权限视图；失败时返回 null，前端按放行处理（本地未接 apex 时不阻塞使用）。 */
export async function fetchAuthContext(): Promise<AuthContext | null> {
  try {
    return await request<AuthContext>(`${BASE}/auth/context`, {
      silent: true,
      headers: tenantHeaders(),
    });
  } catch {
    return null;
  }
}

export async function checkPermission(code: string): Promise<boolean> {
  const result = await request<{ code: string; allowed: boolean }>(
    `${BASE}/auth/check?code=${encodeURIComponent(code)}`,
    { silent: true, headers: tenantHeaders() },
  );
  return !!result?.allowed;
}

export async function listRoles(keyword?: string): Promise<AuthRole[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return request<AuthRole[]>(`${BASE}/roles${query}`, { headers: tenantHeaders() });
}

export async function saveRole(payload: RoleSavePayload): Promise<number> {
  return request<number>(`${BASE}/roles/save`, {
    method: 'POST',
    data: payload,
    headers: tenantHeaders(),
  });
}

export async function changeRoleStatus(ids: number[], enabled: boolean): Promise<void> {
  await request<void>(`${BASE}/roles/status`, {
    method: 'POST',
    data: { ids, enabled },
    headers: tenantHeaders(),
  });
}

export async function getRolePermissions(roleId: number): Promise<string[]> {
  return request<string[]>(`${BASE}/roles/${roleId}/permissions`, {
    headers: tenantHeaders(),
  });
}

export async function updateRolePermissions(
  roleId: number,
  change: RolePermissionChange,
): Promise<void> {
  await request<void>(`${BASE}/roles/${roleId}/permissions`, {
    method: 'POST',
    data: change,
    headers: tenantHeaders(),
  });
}

export async function listMembers(
  keyword?: string,
  options?: { silent?: boolean },
): Promise<OrgMember[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return request<OrgMember[]>(`${BASE}/members${query}`, {
    headers: tenantHeaders(),
    silent: options?.silent,
  });
}

export async function getMemberAuthorization(staffId: number): Promise<MemberAuthorization> {
  return request<MemberAuthorization>(`${BASE}/members/${staffId}/authorization`, {
    headers: tenantHeaders(),
  });
}

export async function updateMemberRoles(staffId: number, roleCodes: string[]): Promise<void> {
  await request<void>(`${BASE}/members/${staffId}/roles`, {
    method: 'POST',
    data: { roleCodes },
    headers: tenantHeaders(),
  });
}

export async function updateMemberPermissions(
  staffId: number,
  change: RolePermissionChange,
): Promise<void> {
  await request<void>(`${BASE}/members/${staffId}/permissions`, {
    method: 'POST',
    data: change,
    headers: tenantHeaders(),
  });
}

export async function listPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  return request<PermissionCatalogItem[]>(`${BASE}/catalog`, { headers: tenantHeaders() });
}

export async function publishPermissionCatalog(): Promise<number> {
  const result = await request<{ published: number }>(`${BASE}/catalog/publish`, {
    method: 'POST',
    headers: tenantHeaders(),
  });
  return result?.published ?? 0;
}
