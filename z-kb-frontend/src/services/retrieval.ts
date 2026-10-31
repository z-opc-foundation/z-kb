import { getTenantCode } from '@/utils/tenant';
import { request } from './http';
import { toast } from '@/utils/toast';

export interface RetrievalHitRecord {
  rank: number;
  chunkId: string;
  materialId: string;
  materialTitle?: string | null;
  materialVersionId: string;
  artifactId: string;
  ordinal: number;
  heading?: string | null;
  content: string;
  charCount: number;
  score: number;
  matchedTerms: string[];
  explanation: string;
  wikiId?: string | null;
  wikiTitle?: string | null;
  wikiStatus?: string | null;
  indexState: string;
  indexedAt?: string | null;
}

export interface RetrievalResultRecord {
  kbId: string;
  query: string;
  mode: string;
  embeddingModel: string;
  topK: number;
  minScore: number;
  totalCandidates: number;
  scanned: number;
  returned: number;
  truncated: boolean;
  tookMs: number;
  hits: RetrievalHitRecord[];
}

const BASE = '/future-brain/v1/knowledgeBase';

export async function retrieveKnowledge(params: {
  kbId: string;
  query: string;
  topK: number;
  minScore: number;
  mode?: string;
}): Promise<RetrievalResultRecord | undefined> {
  try {
    return await request<RetrievalResultRecord>(`${BASE}/retrieve`, {
      method: 'post',
      data: {
        kbId: params.kbId,
        query: params.query,
        topK: params.topK,
        minScore: params.minScore,
        mode: params.mode || 'dense',
      },
      headers: { 'X-Tenant-Code': getTenantCode() },
    });
  } catch (error) {
    toast('检索失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}
