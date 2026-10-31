import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type KnowledgeBaseType = 'FILE' | 'MIX' | 'YUQUE' | 'CODE' | 'DATABASE';

export type KnowledgeBaseStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETING';

export interface PageQuery {
  current?: number;
  size?: number;
  keyword?: string;
  type?: string;
  status?: string;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
}

export interface KnowledgeBaseRecord {
  kbId: string;
  tenantCode: string;
  name: string;
  code: string;
  type: KnowledgeBaseType;
  status: KnowledgeBaseStatus;
  description?: string;
  ownerId: number;
  embeddingModel: string;
  primaryGraphSpaceKey?: string;
  archivedAt?: string;
  createBy: number;
  createTime: string;
  updateBy: number;
  updateTime: string;
  canManage: boolean;
  canManageDoc?: boolean;
  canReview?: boolean;
  role?: string;
  actions?: string[];
}

export interface KnowledgeBaseCreatePayload {
  name: string;
  code: string;
  type: KnowledgeBaseType;
  description?: string;
  embeddingModel?: string;
}

export interface KnowledgeBaseUpdatePayload {
  kbId: string;
  name: string;
  description?: string;
}

const BASE = '/future-brain/v1/knowledgeBase';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(
  run: () => Promise<T>,
  options: { rethrow?: boolean } = {},
): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    if (options.rethrow) {
      throw error;
    }
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function pageKnowledgeBase(
  data: PageQuery,
  options: { rethrow?: boolean } = {},
) {
  return call(
    () =>
      request<PageResult<KnowledgeBaseRecord>>(`${BASE}/page`, {
        method: 'post',
        data,
        headers: tenantHeaders(),
      }),
    options,
  );
}

export function getKnowledgeBase(kbId: string) {
  return call(() =>
    request<KnowledgeBaseRecord>(`${BASE}/queryDetailById`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function createKnowledgeBase(data: KnowledgeBaseCreatePayload) {
  return call(() =>
    request<KnowledgeBaseRecord>(`${BASE}/add`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function updateKnowledgeBase(data: KnowledgeBaseUpdatePayload) {
  return call(() =>
    request<boolean>(`${BASE}/update`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function archiveKnowledgeBase(kbId: string) {
  return call(() =>
    request<boolean>(`${BASE}/archive`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function restoreKnowledgeBase(kbId: string) {
  return call(() =>
    request<boolean>(`${BASE}/restore`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function removeKnowledgeBase(kbId: string) {
  return call(() =>
    request<boolean>(`${BASE}/remove`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}
