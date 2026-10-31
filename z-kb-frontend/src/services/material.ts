import { buildApiUrl, downloadFile, request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import type { PageResult } from '@/services/knowledgeBase';

export interface MaterialRecord {
  materialId: string;
  kbId: string;
  materialType: 'DOCUMENT' | 'CODE' | 'DATA_TABLE';
  entryType?: string;
  title: string;
  sourceType: string;
  categoryId?: string | null;
  materialStatus: string;
  fingerprint: string;
  currentVersionId?: string | null;
  versionNo?: number;
  fileName?: string;
  fileExt?: string;
  sizeBytes?: number;
  versionStatus?: string;
  parseStatus?: string;
  compileStatus: string;
  governanceStatus: string;
  registeredBy: number;
  registeredAt?: string;
  updateTime?: string;
}

export interface MaterialVersionRecord {
  versionId: string;
  versionNo: number;
  fileName: string;
  fileExt?: string;
  sizeBytes: number;
  fingerprint: string;
  sourceVersion?: string;
  versionStatus: string;
  currentParsedDraftId?: string;
  registeredAt?: string;
}

export interface ParsedDraftRecord {
  draftId: string;
  status: string;
  parserName: string;
  parserVersion: string;
  parsedAt?: string;
  failureReason?: string;
  textContent?: string;
  textLength: number;
}

export interface MaterialDetailRecord {
  material: MaterialRecord;
  versions: MaterialVersionRecord[];
  currentDraft?: ParsedDraftRecord | null;
}

export interface MaterialUploadItem {
  fileName: string;
  success: boolean;
  duplicated: boolean;
  materialId?: string;
  versionId?: string;
  parseStatus?: string;
  message: string;
}

export interface MaterialBatchItem {
  materialId: string;
  success: boolean;
  message: string;
}

export interface MaterialPageQuery {
  current?: number;
  size?: number;
  kbId: string;
  keyword?: string;
  categoryId?: string;
  materialType?: string;
  materialStatus?: string;
}

const BASE = '/future-brain/v1/material';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function pageMaterial(data: MaterialPageQuery) {
  return call(() =>
    request<PageResult<MaterialRecord>>(`${BASE}/page`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function uploadMaterials(kbId: string, categoryId: string | undefined, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const params = new URLSearchParams();
  params.set('kbId', kbId);
  if (categoryId) {
    params.set('categoryId', categoryId);
  }
  return call(() =>
    request<MaterialUploadItem[]>(`${BASE}/upload?${params.toString()}`, {
      method: 'post',
      data: form,
      headers: tenantHeaders(),
      timeout: 120_000,
    }),
  );
}

export function getMaterial(materialId: string) {
  return call(() =>
    request<MaterialDetailRecord>(`${BASE}/queryDetailById`, {
      method: 'get',
      params: { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function listRecentMaterials(kbId: string, limit = 5) {
  return call(() =>
    request<MaterialRecord[]>(`${BASE}/listRecent`, {
      method: 'get',
      params: { kbId, limit },
      headers: tenantHeaders(),
    }),
  );
}

export function updateMaterialCategory(
  kbId: string,
  materialIds: string[],
  categoryId?: string,
) {
  return call(() =>
    request<MaterialBatchItem[]>(`${BASE}/updateCategory`, {
      method: 'post',
      data: { kbId, materialIds, categoryId },
      headers: tenantHeaders(),
    }),
  );
}

export function removeMaterials(kbId: string, materialIds: string[]) {
  return call(() =>
    request<MaterialBatchItem[]>(`${BASE}/remove`, {
      method: 'post',
      data: { kbId, materialIds },
      headers: tenantHeaders(),
    }),
  );
}

export function reviseMaterial(
  kbId: string,
  materialId: string,
  file: File,
  sourceVersion?: string,
) {
  const form = new FormData();
  form.append('file', file);
  const params = new URLSearchParams({ kbId, materialId });
  if (sourceVersion) {
    params.set('sourceVersion', sourceVersion);
  }
  return call(() =>
    request<MaterialUploadItem>(`${BASE}/revise?${params.toString()}`, {
      method: 'post',
      data: form,
      headers: tenantHeaders(),
      timeout: 120_000,
    }),
  );
}

export function reparseMaterial(materialId: string, versionId?: string) {
  return call(() =>
    request<ParsedDraftRecord>(`${BASE}/reparse`, {
      method: 'post',
      data: versionId ? { materialId, versionId } : { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function saveDraftText(
  materialId: string,
  textContent: string,
  versionId?: string,
) {
  return call(() =>
    request<ParsedDraftRecord>(`${BASE}/saveDraftText`, {
      method: 'post',
      data: versionId ? { materialId, versionId, textContent } : { materialId, textContent },
      headers: tenantHeaders(),
    }),
  );
}

export function listDrafts(materialId: string, versionId?: string) {
  return call(() =>
    request<ParsedDraftRecord[]>(`${BASE}/listDrafts`, {
      method: 'get',
      params: versionId ? { materialId, versionId } : { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function restoreMaterials(kbId: string, materialIds: string[]) {
  return call(() =>
    request<MaterialBatchItem[]>(`${BASE}/restore`, {
      method: 'post',
      data: { kbId, materialIds },
      headers: tenantHeaders(),
    }),
  );
}

export function pageDeletedMaterials(data: MaterialPageQuery) {
  return call(() =>
    request<PageResult<MaterialRecord>>(`${BASE}/pageDeleted`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function purgeMaterials(kbId: string, materialIds: string[]) {
  return call(() =>
    request<MaterialBatchItem[]>(`${BASE}/purge`, {
      method: 'post',
      data: { kbId, materialIds },
      headers: tenantHeaders(),
    }),
  );
}

export function materialDownloadUrl(materialId: string, versionId?: string) {
  const params = new URLSearchParams({ materialId });
  if (versionId) {
    params.set('versionId', versionId);
  }
  return buildApiUrl(`${BASE}/download`, params);
}

export async function downloadMaterial(materialId: string, versionId?: string) {
  const blob = await downloadFile(`${BASE}/download`, {
    method: 'get',
    params: versionId ? { materialId, versionId } : { materialId },
    headers: tenantHeaders(),
  });
  return blob;
}
