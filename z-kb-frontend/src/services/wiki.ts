import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface WikiPageRecord {
  wikiId: string;
  ***REMOVED***Id: string;
  materialId: string;
  materialVersionId?: string | null;
  title: string;
  summary?: string | null;
  pointCount: number;
  charCount?: number;
  versionNo: number;
  sourceCount?: number;
  status: string;
  updateTime?: string;
}

export interface WikiPointRecord {
  heading: string;
  text: string;
}

export interface WikiSourceRecord {
  materialId: string;
  materialVersionId?: string | null;
  materialTitle: string;
  sourceVersionNo?: number;
}

export interface WikiDetailRecord {
  page: WikiPageRecord;
  points: WikiPointRecord[];
  sources: WikiSourceRecord[];
  graphNodeCount: number;
  note?: string;
}

export interface WikiGenerateItemRecord {
  materialId: string;
  title?: string;
  wikiId?: string;
  status: string;
  versionNo?: number;
  failureSummary?: string;
}

export interface WikiGenerateResultRecord {
  totalCount: number;
  successCount: number;
  failedCount: number;
  items: WikiGenerateItemRecord[];
}

export interface WikiLineageNodeRecord {
  nodeId: string;
  nodeType: 'MATERIAL' | 'WIKI' | string;
  label: string;
  refId: string;
}

export interface WikiLineageEdgeRecord {
  fromNodeId: string;
  toNodeId: string;
  relation: string;
}

export interface WikiLineageRecord {
  wikiId?: string | null;
  title?: string;
  nodes: WikiLineageNodeRecord[];
  edges: WikiLineageEdgeRecord[];
  relationTypes: string[];
  sourceCount: number;
  graphNodeCount: number;
  note?: string;
}

const BASE = '/***REMOVED***/v1/wiki';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function generateWiki(***REMOVED***Id: string, materialIds: string[]) {
  return call(() =>
    request<WikiGenerateResultRecord>(`${BASE}/generate`, {
      method: 'post',
      data: { ***REMOVED***Id, materialIds },
      headers: tenantHeaders(),
    }),
  );
}

export function listWikiPages(***REMOVED***Id: string, keyword?: string, limit = 50) {
  return call(() =>
    request<WikiPageRecord[]>(`${BASE}/list`, {
      method: 'get',
      params: { ***REMOVED***Id, keyword: keyword || undefined, limit },
      headers: tenantHeaders(),
    }),
  );
}

export function getWikiDetail(wikiId: string) {
  return call(() =>
    request<WikiDetailRecord>(`${BASE}/detail`, {
      method: 'get',
      params: { wikiId },
      headers: tenantHeaders(),
    }),
  );
}

export function listWikiByMaterial(materialId: string) {
  return call(() =>
    request<WikiPageRecord[]>(`${BASE}/listByMaterial`, {
      method: 'get',
      params: { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function getWikiLineage(params: { ***REMOVED***Id?: string; wikiId?: string }) {
  return call(() =>
    request<WikiLineageRecord>(`${BASE}/lineage`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}
