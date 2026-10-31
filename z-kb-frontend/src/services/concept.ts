import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface ConceptRecord {
  conceptId: string;
  name: string;
  conceptType: string;
  status: 'EMERGING' | 'CONFIRMED' | string;
  definition?: string | null;
  mentionCount: number;
  materialCount: number;
  firstMaterialId?: string | null;
  lastMaterialId?: string | null;
  graphNodeId?: string | null;
  evidence?: string | null;
}

export interface ConceptMentionRecord {
  mentionId: string;
  conceptId: string;
  materialId: string;
  materialTitle?: string | null;
  materialVersionId: string;
  extractionItemId?: string | null;
  chunkOrdinal: number;
  occurrenceCount: number;
  evidence?: string | null;
}

export interface ConceptDetailRecord {
  concept: ConceptRecord;
  mentions: ConceptMentionRecord[];
}

const BASE = '/future-brain/v1/concept';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function listConceptsByKb(kbId: string, keyword?: string) {
  return call(() =>
    request<ConceptRecord[]>(`${BASE}/listByKb`, {
      method: 'get',
      params: { kbId, keyword: keyword || undefined },
      headers: tenantHeaders(),
    }),
  );
}

export function getConcept(kbId: string, conceptId: string) {
  return call(() =>
    request<ConceptDetailRecord>(`${BASE}/queryById`, {
      method: 'get',
      params: { kbId, conceptId },
      headers: tenantHeaders(),
    }),
  );
}
