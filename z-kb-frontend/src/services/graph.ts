import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface GraphNodeRecord {
  nodeId: string;
  nodeType: string;
  conceptId?: string | null;
  name: string;
  materialId?: string | null;
  evidence?: string | null;
}

export interface GraphEdgeRecord {
  edgeId: string;
  edgeType: string;
  sourceNodeId: string;
  targetNodeId: string;
  evidence?: string | null;
}

export interface KnowledgeGraphRecord {
  kbId: string;
  graphSpaceKey?: string | null;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
}

const BASE = '/future-brain/v1/graph';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function getGraphByMaterial(materialId: string) {
  return call(() =>
    request<KnowledgeGraphRecord>(`${BASE}/queryByMaterial`, {
      method: 'get',
      params: { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function getGraphByKb(kbId: string) {
  return call(() =>
    request<KnowledgeGraphRecord>(`${BASE}/queryByKb`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}
