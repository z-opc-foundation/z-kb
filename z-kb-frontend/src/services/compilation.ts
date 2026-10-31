import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface CompilationStageRecord {
  stage: string;
  status: string;
  attempt?: number;
  inputRef?: string | null;
  outputRef?: string | null;
  detail?: string | null;
  startedAt?: string;
  finishedAt?: string;
}

export interface CompilationLedgerRecord {
  ledgerId: string;
  expectedCount: number;
  settledCount: number;
  failedCount: number;
  deadCount: number;
  status: string;
  plannedAt?: string;
  closedAt?: string;
}

export interface CompilationArtifactRecord {
  artifactId: string;
  artifactType: string;
  title: string;
  lifecycleStatus: string;
  retrievalState: string;
  currentVersionId?: string;
  versionNo?: number;
  contentHash?: string;
  storageRef?: string;
  evidenceRef: string;
  publishedAt?: string;
}

export interface CompilationJobRecord {
  jobId: string;
  kbId: string;
  materialId: string;
  materialVersionId: string;
  pipelineType: string;
  configVersion: string;
  configSnapshot?: string | null;
  compilerVersion: string;
  runStatus: string;
  milestone: string;
  currentStage?: string;
  ledgerId?: string;
  chunkCount: number;
  m1At?: string;
  m2At?: string;
  startedAt?: string;
  finishedAt?: string;
  failureSummary?: string;
  reused: boolean;
  taskId?: string;
  taskStatus?: string;
  stages: CompilationStageRecord[];
  ledger?: CompilationLedgerRecord | null;
  artifact?: CompilationArtifactRecord | null;
}

export interface CompilationBatchMemberRecord {
  jobId?: string;
  materialId: string;
  materialVersionId: string;
  materialTitle?: string;
  itemStatus: string;
  itemFailureSummary?: string;
  jobStatus?: string;
  milestone?: string;
  chunkCount?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface CompilationBatchRecord {
  batchId: string;
  kbId: string;
  name: string;
  taskType: string;
  scopeType: string;
  scopeId?: string;
  scopeCount: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: string;
  failureSummary?: string;
  startedAt?: string;
  finishedAt?: string;
  createBy?: number;
  submitterName?: string;
  createTime?: string;
  members?: CompilationBatchMemberRecord[];
}

export interface CompilationBatchPageRecord {
  records: CompilationBatchRecord[];
  total: number;
  pageNo: number;
  pageSize: number;
}

export interface RetrievalChunkRecord {
  chunkId: string;
  materialId: string;
  materialVersionId: string;
  artifactId: string;
  ordinal: number;
  heading?: string;
  content: string;
  charCount: number;
  indexState: string;
  indexedAt?: string;
}

const BASE = '/future-brain/v1/compilation';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function runCompilation(materialId: string, versionId?: string) {
  return call(() =>
    request<CompilationJobRecord>(`${BASE}/run`, {
      method: 'post',
      data: versionId ? { materialId, versionId } : { materialId },
      headers: tenantHeaders(),
      timeout: 15_000,
    }),
  );
}

export function retryCompilation(jobId: string, startStage: string) {
  return call(() =>
    request<CompilationJobRecord>(`${BASE}/retry`, {
      method: 'post',
      data: { jobId, startStage },
      headers: tenantHeaders(),
      timeout: 15_000,
    }),
  );
}

export function cancelCompilation(jobId: string) {
  return call(() =>
    request<CompilationJobRecord>(`${BASE}/cancel`, {
      method: 'post',
      data: { jobId },
      headers: tenantHeaders(),
      timeout: 15_000,
    }),
  );
}

export function cancelCompilationBatch(batchId: string) {
  return call(() =>
    request<CompilationBatchRecord>(`${BASE}/cancelBatch`, {
      method: 'post',
      data: { batchId },
      headers: tenantHeaders(),
      timeout: 15_000,
    }),
  );
}

export function isCompilationActive(status?: string): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

export function getCompilationByMaterial(materialId: string, versionId?: string) {
  return call(() =>
    request<CompilationJobRecord | null>(`${BASE}/queryByMaterial`, {
      method: 'get',
      params: versionId ? { materialId, versionId } : { materialId },
      headers: tenantHeaders(),
    }),
  );
}

export function getCompilationByJob(jobId: string) {
  return call(() =>
    request<CompilationJobRecord>(`${BASE}/queryByJob`, {
      method: 'get',
      params: { jobId },
      headers: tenantHeaders(),
    }),
  );
}

export function listCompilationJobs(kbId: string, materialId?: string, limit = 20) {
  return call(() =>
    request<CompilationJobRecord[]>(`${BASE}/listByKb`, {
      method: 'get',
      params: materialId ? { kbId, materialId, limit } : { kbId, limit },
      headers: tenantHeaders(),
    }),
  );
}

export function listCompilationChunks(materialId: string, versionId?: string, limit = 100) {
  return call(() =>
    request<RetrievalChunkRecord[]>(`${BASE}/listChunks`, {
      method: 'get',
      params: versionId ? { materialId, versionId, limit } : { materialId, limit },
      headers: tenantHeaders(),
    }),
  );
}

export function createCompilationBatch(payload: {
  kbId: string;
  name?: string;
  scopeType?: string;
  scopeId?: string;
  materialIds?: string[];
}) {
  return call(() =>
    request<CompilationBatchRecord>(`${BASE}/createBatch`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
      timeout: 15_000,
    }),
  );
}

export function listCompilationBatches(kbId: string, limit = 20) {
  return call(() =>
    request<CompilationBatchRecord[]>(`${BASE}/listBatches`, {
      method: 'get',
      params: { kbId, limit },
      headers: tenantHeaders(),
    }),
  );
}

export function pageCompilationBatches(kbId: string, pageNo = 1, pageSize = 20) {
  return call(() =>
    request<CompilationBatchPageRecord>(`${BASE}/pageBatches`, {
      method: 'get',
      params: { kbId, pageNo, pageSize },
      headers: tenantHeaders(),
    }),
  );
}

export function getCompilationBatch(batchId: string) {
  return call(() =>
    request<CompilationBatchRecord>(`${BASE}/queryBatch`, {
      method: 'get',
      params: { batchId },
      headers: tenantHeaders(),
    }),
  );
}

export function hasRunningCompilationBatch(kbId: string) {
  return call(() =>
    request<boolean>(`${BASE}/hasRunningBatch`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function searchCompilationChunks(kbId: string, keyword?: string, limit = 20) {
  return call(() =>
    request<RetrievalChunkRecord[]>(`${BASE}/search`, {
      method: 'get',
      params: keyword ? { kbId, keyword, limit } : { kbId, limit },
      headers: tenantHeaders(),
    }),
  );
}
