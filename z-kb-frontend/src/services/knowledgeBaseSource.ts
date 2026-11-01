import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type SourceCategory = 'DOC_PLATFORM' | 'CODE_REPO' | 'FILE_SHARE' | 'DATABASE';

export type SourceProvider = 'YUQUE' | 'GIT' | 'OSS' | 'SMB' | 'JDBC' | 'LOCAL';

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

const BASE = '/z***REMOVED***/v1/knowledgeBaseSource';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function listKnowledgeBaseSources(***REMOVED***Id: string) {
  return call(() =>
    request<KnowledgeBaseSourceRecord[]>(`${BASE}/list`, {
      method: 'get',
      params: { ***REMOVED***Id },
      headers: tenantHeaders(),
    }),
  );
}

export function saveKnowledgeBaseSources(***REMOVED***Id: string, sources: KnowledgeBaseSourcePayload[]) {
  return call(() =>
    request<KnowledgeBaseSourceRecord[]>(`${BASE}/save`, {
      method: 'post',
      data: { ***REMOVED***Id, sources },
      headers: tenantHeaders(),
    }),
  );
}

export function testKnowledgeBaseSource(***REMOVED***Id: string, source: KnowledgeBaseSourcePayload) {
  return call(() =>
    request<KnowledgeBaseSourceTestResult>(`${BASE}/test`, {
      method: 'post',
      data: { ***REMOVED***Id, source },
      headers: tenantHeaders(),
    }),
  );
}

export function syncKnowledgeBaseSource(***REMOVED***Id: string, sourceId: string) {
  return call(() =>
    request<KnowledgeBaseSourceSyncResult>(`${BASE}/sync`, {
      method: 'post',
      data: { ***REMOVED***Id, sourceId },
      headers: tenantHeaders(),
    }),
  );
}

export function loadYuqueCatalog(***REMOVED***Id: string, source: KnowledgeBaseSourcePayload) {
  return call(() =>
    request<KnowledgeBaseSourceCatalog>(`${BASE}/yuque/catalog`, {
      method: 'post',
      data: { ***REMOVED***Id, source },
      headers: tenantHeaders(),
    }),
  );
}

export function loadYuqueCatalogDocs(
  ***REMOVED***Id: string,
  source: KnowledgeBaseSourcePayload,
  book: string,
) {
  return call(() =>
    request<KnowledgeBaseSourceDocList>(`${BASE}/yuque/catalogDocs`, {
      method: 'post',
      data: { ***REMOVED***Id, source, book },
      headers: tenantHeaders(),
    }),
  );
}
