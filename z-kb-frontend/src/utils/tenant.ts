/**
 * 租户上下文。头名与登录态方案待 R17 拍板，当前先由前端显式携带。
 */
const TENANT_STORAGE_KEY = 'future-knowledge.tenant-code';

export const DEFAULT_TENANT_CODE = 'future_hospital';

export interface TenantInfo {
  code: string;
  name: string;
  mark: string;
}

export const TENANTS: TenantInfo[] = [
  { code: DEFAULT_TENANT_CODE, name: '未来医院', mark: '未' },
];

export function getTenantInfo(tenantCode?: string): TenantInfo {
  const code = tenantCode || getTenantCode();
  const known = TENANTS.find((item) => item.code === code);
  if (known) {
    return known;
  }
  return { code, name: code, mark: code.slice(0, 1).toUpperCase() };
}

/** 本地代理注入的操作人，线上由网关注入真实身份。 */
export function getActorId(): number {
  const value = Number(__LOCAL_ACTOR_ID__);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getTenantCode(): string {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY) || DEFAULT_TENANT_CODE;
  } catch (e) {
    return DEFAULT_TENANT_CODE;
  }
}

export function setTenantCode(tenantCode: string): void {
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, tenantCode);
  } catch (e) {
    // localStorage 不可用时保持默认租户，不阻断请求
  }
}
