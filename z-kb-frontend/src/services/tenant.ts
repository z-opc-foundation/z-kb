import { getTenantCode } from '@/utils/tenant';
import { request } from './http';

/** 与后端 sys_tenant.status 对齐：只区分启用与停用。 */
export type TenantStatus = 'ACTIVE' | 'DISABLED';

export interface TenantRecord {
  /** 雪花 ID 以字符串下发，避免 number 精度丢失。 */
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  description?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface TenantQuery {
  keyword?: string;
  status?: TenantStatus;
}

export interface TenantSavePayload {
  id?: string;
  code?: string;
  name: string;
  description?: string;
}

const BASE = '/future-brain/v1/identity/tenants';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

export function listTenants(query: TenantQuery = {}) {
  return request<TenantRecord[]>(BASE, {
    headers: tenantHeaders(),
    params: {
      keyword: query.keyword || undefined,
      status: query.status || undefined,
    },
  });
}

export function saveTenant(payload: TenantSavePayload) {
  return request<string>(`${BASE}/save`, {
    method: 'POST',
    data: payload,
    headers: tenantHeaders(),
  });
}

export function changeTenantStatus(id: string, status: TenantStatus) {
  return request<void>(`${BASE}/${id}/status`, {
    method: 'POST',
    data: { status },
    headers: tenantHeaders(),
  });
}

export function deleteTenant(id: string) {
  return request<void>(`${BASE}/${id}/delete`, {
    method: 'POST',
    headers: tenantHeaders(),
  });
}
