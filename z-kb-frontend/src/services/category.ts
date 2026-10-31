import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type CategoryNodeKind = 'FOLDER' | 'SOURCE' | 'SOURCE_BOOK' | 'SOURCE_REPO';

export interface CategoryNode {
  categoryId: string;
  parentId?: string | null;
  name: string;
  sortNo: number;
  /** 节点性质：普通分类或接入源同步出来的只读来源节点。 */
  nodeKind?: CategoryNodeKind | string;
  /** 来源节点绑定的扩展信息（sourceId/provider/namespace/book/repo 等）。 */
  ext?: Record<string, unknown> | null;
  children?: CategoryNode[];
}

const BASE = '/future-brain/v1/materialCategory';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function getCategoryTree(kbId: string) {
  return call(() =>
    request<CategoryNode[]>(`${BASE}/tree`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function createCategory(kbId: string, name: string, parentId?: string) {
  return call(() =>
    request<CategoryNode>(`${BASE}/add`, {
      method: 'post',
      data: { kbId, name, parentId },
      headers: tenantHeaders(),
    }),
  );
}

export function renameCategory(categoryId: string, name: string) {
  return call(() =>
    request<boolean>(`${BASE}/update`, {
      method: 'post',
      data: { categoryId, name },
      headers: tenantHeaders(),
    }),
  );
}

export function moveCategory(categoryId: string, parentId?: string) {
  return call(() =>
    request<boolean>(`${BASE}/move`, {
      method: 'post',
      data: { categoryId, parentId: parentId || null },
      headers: tenantHeaders(),
    }),
  );
}

export function removeCategory(categoryId: string) {
  return call(() =>
    request<boolean>(`${BASE}/remove`, {
      method: 'post',
      data: { categoryId },
      headers: tenantHeaders(),
    }),
  );
}
