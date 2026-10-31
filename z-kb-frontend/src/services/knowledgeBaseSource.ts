import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type SourceCategory = 'DOC_PLATFORM' | 'CODE_REPO' | 'FILE_SHARE' | 'DATABASE';

export type SourceProvider = 'YUQUE' | 'GIT' | 'OSS' | 'SMB' | 'JDBC';

export interface KnowledgeBaseSourceRecord {
  sourceId: string;
  category: SourceCategory | string;
  provider: SourceProvider | string;
  name: string;
  enabled: boolean;
  scope?: Record<string, unknown>;
  credentialType?: string;
  credentialUsername?: string;
  secretRef?: string;
  hasSecret?: boolean;
}

export interface KnowledgeBaseSourcePayload {
  sourceId?: string;
  category?: string;
  provider: string;
  name: string;
  enabled: boolean;
  scope?: Record<string, unknown>;
  credentialType?: string;
  credentialUsername?: string;
  secret?: string;
  secretRef?: string;
}

export interface KnowledgeBaseSourceTestResult {
  reachable: boolean;
  message: string;
  latencyMs: number;
}

export interface KnowledgeBaseSourceSyncResult {
  scopeId: number;
  sourceId: string;
  provider: string;
  reusing: boolean;
}

export interface KnowledgeBaseSourceSpace {
  slug: string;
  name: string;
}

export interface KnowledgeBaseSourceBook {
  namespace: string;
  slug: string;
  name: string;
  docsCount?: number | null;
  visibility?: number | null;
}

export interface KnowledgeBaseSourceCatalog {
  spaces: KnowledgeBaseSourceSpace[];
  books: KnowledgeBaseSourceBook[];
  message?: string;
}

export interface KnowledgeBaseSourceDoc {
  slug: string;
  title: string;
  updatedAt?: string;
}

export interface KnowledgeBaseSourceDocList {
  docs: KnowledgeBaseSourceDoc[];
  message?: string;
}

const BASE = '/future-brain/v1/knowledgeBaseSource';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function listKnowledgeBaseSources(kbId: string) {
  return call(() =>
    request<KnowledgeBaseSourceRecord[]>(`${BASE}/list`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function saveKnowledgeBaseSources(kbId: string, sources: KnowledgeBaseSourcePayload[]) {
  return call(() =>
    request<KnowledgeBaseSourceRecord[]>(`${BASE}/save`, {
      method: 'post',
      data: { kbId, sources },
      headers: tenantHeaders(),
    }),
  );
}

export function testKnowledgeBaseSource(kbId: string, source: KnowledgeBaseSourcePayload) {
  return call(() =>
    request<KnowledgeBaseSourceTestResult>(`${BASE}/test`, {
      method: 'post',
      data: { kbId, source },
      headers: tenantHeaders(),
    }),
  );
}

export function syncKnowledgeBaseSource(kbId: string, sourceId: string) {
  return call(() =>
    request<KnowledgeBaseSourceSyncResult>(`${BASE}/sync`, {
      method: 'post',
      data: { kbId, sourceId },
      headers: tenantHeaders(),
    }),
  );
}

export function loadYuqueCatalog(kbId: string, source: KnowledgeBaseSourcePayload) {
  return call(() =>
    request<KnowledgeBaseSourceCatalog>(`${BASE}/yuque/catalog`, {
      method: 'post',
      data: { kbId, source },
      headers: tenantHeaders(),
    }),
  );
}

export function loadYuqueCatalogDocs(
  kbId: string,
  source: KnowledgeBaseSourcePayload,
  book: string,
) {
  return call(() =>
    request<KnowledgeBaseSourceDocList>(`${BASE}/yuque/catalogDocs`, {
      method: 'post',
      data: { kbId, source, book },
      headers: tenantHeaders(),
    }),
  );
}
