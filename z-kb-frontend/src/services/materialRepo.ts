import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface RepoEntry {
  name: string;
  path: string;
  entryType: 'DIR' | 'FILE';
}

export interface RepoOverview {
  materialId: string;
  title: string;
  provider: string;
  repo: string;
  repoUrl: string;
  branch: string;
  commit?: string | null;
  fileCount?: number | null;
  docCount?: number | null;
  codeCount?: number | null;
  entries: RepoEntry[];
}

export interface RepoFile {
  name: string;
  path: string;
  fileExt?: string | null;
  sizeBytes?: number | null;
  binary: boolean;
  truncated: boolean;
  content?: string | null;
}

const BASE = '/future-brain/v1/material/repo';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

/** 仓库概览：分支、提交、文件统计与根目录子项。 */
export function getRepoOverview(materialId: string) {
  return call(() =>
    request<RepoOverview>(`${BASE}/overview`, {
      method: 'get',
      params: { materialId },
      headers: tenantHeaders(),
    }),
  );
}

/** 列出目录下的直接子项，path 为空表示根目录。 */
export function listRepoEntries(materialId: string, path?: string) {
  return call(() =>
    request<RepoEntry[]>(`${BASE}/tree`, {
      method: 'get',
      params: path ? { materialId, path } : { materialId },
      headers: tenantHeaders(),
    }),
  );
}

/** 读取单个文件的文本内容，二进制文件只返回标记。 */
export function readRepoFile(materialId: string, path: string) {
  return call(() =>
    request<RepoFile>(`${BASE}/file`, {
      method: 'get',
      params: { materialId, path },
      headers: tenantHeaders(),
    }),
  );
}
