import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface ExtractionItemRecord {
  itemId?: string;
  itemType?: string;
  seq: number;
  title?: string | null;
  content?: string | null;
  evidence?: string | null;
  conceptId?: string | null;
  conceptName?: string | null;
  conceptStatus?: string | null;
}

export interface ExtractionSummaryRecord {
  title?: string | null;
  content?: string | null;
  evidence?: string | null;
}

export interface ExtractionCountsRecord {
  summary: number;
  question: number;
  term: number;
  faq: number;
  graphNode: number;
  graphEdge: number;
}

export interface MaterialExtractionRecord {
  materialId: string;
  materialVersionId?: string | null;
  milestone: string;
  counts: ExtractionCountsRecord;
  summary?: ExtractionSummaryRecord | null;
  questions: ExtractionItemRecord[];
  terms: ExtractionItemRecord[];
  faqs: ExtractionItemRecord[];
}

const BASE = '/future-brain/v1/extraction';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function getExtractionByMaterial(materialId: string) {
  return call(() =>
    request<MaterialExtractionRecord>(`${BASE}/queryByMaterial`, {
      method: 'get',
      params: { materialId },
      headers: tenantHeaders(),
    }),
  );
}
