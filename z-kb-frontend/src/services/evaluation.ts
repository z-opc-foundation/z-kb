import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';

/**
 * T-11 知识评测接口。
 * 契约：BASE /future-brain/v1/evaluation，字段名不可改。
 */

export interface EvalPageQuery {
  current?: number;
  size?: number;
  keyword?: string;
}

export interface EvalPageResult<T> {
  records: T[];
  total: number;
  current?: number;
  size?: number;
}

export interface EvalNotConnectedItem {
  code?: string;
  label?: string;
  name?: string;
  status?: string;
  detail?: string;
}

export type EvalNotConnected = string | EvalNotConnectedItem;

export interface EvalBadcaseCounts {
  open?: number | null;
  fixed?: number | null;
  regressed?: number | null;
}

export interface EvalEvidenceItem {
  code: string;
  label?: string | null;
  status?: string | null;
  detail?: string | null;
}

export interface EvalKbListRecord {
  kbId: string;
  kbName: string;
  datasetVersion?: string | null;
  datasetStatus?: string | null;
  caseCount?: number | null;
  lastRunId?: string | null;
  lastRunAt?: string | null;
  resultUsable?: boolean | null;
  corePassCount?: number | null;
  coreTotal?: number | null;
  openBadcaseCount?: number | null;
  notConnected?: EvalNotConnected[] | null;
}

export interface EvalRunBrief {
  runId: string;
  status?: string | null;
  resultUsable?: boolean | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  corePassCount?: number | null;
  coreTotal?: number | null;
}

export interface EvalDatasetMeta {
  versionNo?: string | null;
  status?: string | null;
  caseCount?: number | null;
  publishedAt?: string | null;
}

export interface EvalOverview {
  kbId?: string | null;
  kbName?: string | null;
  dataset?: EvalDatasetMeta | null;
  lastRun?: EvalRunBrief | null;
  baselineRun?: { runId: string; finishedAt?: string | null } | null;
  comparable?: boolean | null;
  badcaseCounts?: EvalBadcaseCounts | null;
  evidence?: EvalEvidenceItem[] | null;
  notConnected?: EvalNotConnected[] | null;
}

export interface EvalDatasetCase {
  caseId?: string | null;
  caseNo?: string | number | null;
  question: string;
  expectedAnswer?: string | null;
  expectedBehavior?: string | null;
  expectedEvidence?: unknown;
  tags?: string[] | null;
}

export interface EvalDatasetDetail {
  dataset?: EvalDatasetMeta | null;
  cases?: EvalDatasetCase[] | null;
}

export interface EvalDatasetDraftCase {
  caseNo: string;
  question: string;
  expectedAnswer: string;
  expectedBehavior: string;
  expectedEvidence: unknown;
  tags: string[];
}

export interface EvalDatasetDraftPayload {
  kbId: string;
  name: string;
  description?: string;
  cases: EvalDatasetDraftCase[];
}

export interface EvalMetricRecord {
  metricCode: string;
  metricName?: string | null;
  metricLayer?: string | null;
  stageCode?: string | null;
  value?: number | null;
  unit?: string | null;
  targetValue?: number | null;
  status?: string | null;
  sampleSize?: number | null;
  attribution?: string | null;
  note?: string | null;
}

export interface EvalStageRecord {
  stageCode: string;
  stageName?: string | null;
  status?: string | null;
  metrics?: EvalMetricRecord[] | null;
  failingCaseCount?: number | null;
}

export interface EvalRunRecord {
  runId: string;
  kbId?: string | null;
  status?: string | null;
  resultUsable?: boolean | null;
  unusableReason?: string | null;
  datasetVersionNo?: string | null;
  snapshotId?: string | null;
  configVersion?: string | null;
  taskConfigVersion?: string | null;
  judgeMode?: string | null;
  judgeVersion?: string | null;
  indexGeneration?: string | number | null;
  scopeType?: string | null;
  stageCode?: string | null;
  caseTotal?: number | null;
  caseDone?: number | null;
  retrievalTruncated?: boolean | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface EvalRunBaselineMetric {
  metricCode: string;
  value?: number | null;
  status?: string | null;
}

export interface EvalRunBaseline {
  runId: string;
  finishedAt?: string | null;
  metrics?: EvalRunBaselineMetric[] | null;
}

export interface EvalRunDetail {
  run: EvalRunRecord;
  metrics?: EvalMetricRecord[] | null;
  stages?: EvalStageRecord[] | null;
  badcaseCounts?: EvalBadcaseCounts | null;
  evidence?: EvalEvidenceItem[] | null;
  baseline?: EvalRunBaseline | null;
  comparable?: boolean | null;
}

export interface EvalCaseResultRecord {
  caseId: string;
  caseNo?: string | number | null;
  question?: string | null;
  answer?: string | null;
  answerMode?: string | null;
  metrics?: unknown;
  retrieved?: unknown;
  citations?: unknown;
  stageTrace?: unknown;
  latencyMs?: number | null;
  errorMessage?: string | null;
  badcaseStages?: string[] | null;
}

export interface EvalCasePagePayload {
  runId: string;
  current: number;
  size: number;
  onlyBad: boolean;
  stageCode?: string;
}

export interface EvalBadcaseRecord {
  badcaseId: string;
  caseId?: string | null;
  question?: string | null;
  stageCode?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  owner?: string | null;
  note?: string | null;
  occurrenceCount?: number | null;
  lastSeenRunId?: string | null;
}

export interface EvalTrustEvidence {
  items?: EvalEvidenceItem[] | null;
  evidence?: EvalEvidenceItem[] | null;
  records?: EvalEvidenceItem[] | null;
}

export interface EvalCreateRunPayload {
  kbId: string;
  datasetVersionNo?: string;
  baselineRunId?: string;
  allowReuse: true;
}

export interface EvalCreateRunResult {
  runId: string;
  status?: string | null;
  resultUsable?: boolean | null;
  unusableReason?: string | null;
  datasetVersionNo?: string | null;
  snapshotId?: string | null;
  configVersion?: string | null;
  judgeVersion?: string | null;
  indexGeneration?: string | number | null;
  caseTotal?: number | null;
  caseDone?: number | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  reused?: boolean | null;
}

const BASE = '/future-brain/v1/evaluation';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function read<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    // 读取失败由页面展示错误 / 空态，不使用本地样本补齐。
    console.error('[evaluation]', (error as Error).message || 'request failed');
    return undefined;
  }
}

export function pageEvaluationKnowledgeBases(data: EvalPageQuery) {
  return read(() =>
    request<EvalPageResult<EvalKbListRecord>>(`${BASE}/pageKnowledgeBase`, {
      method: 'get',
      params: {
        current: data.current,
        size: data.size,
        ...(data.keyword ? { keyword: data.keyword } : {}),
      },
      headers: tenantHeaders(),
    }),
  );
}

export function queryEvalOverview(kbId: string, baselineRunId?: string) {
  return read(() =>
    request<EvalOverview>(`${BASE}/queryOverview`, {
      method: 'get',
      params: {
        kbId,
        ...(baselineRunId ? { baselineRunId } : {}),
      },
      headers: tenantHeaders(),
    }),
  );
}

export function queryEvalDataset(kbId: string, versionNo?: string) {
  return read(() =>
    request<EvalDatasetDetail | EvalDatasetCase[]>(`${BASE}/queryDataset`, {
      method: 'get',
      params: {
        kbId,
        ...(versionNo ? { versionNo } : {}),
      },
      headers: tenantHeaders(),
    }),
  );
}

export function saveEvalDatasetDraft(payload: EvalDatasetDraftPayload) {
  return read(() =>
    request<unknown>(`${BASE}/saveDatasetDraft`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
    }),
  );
}

export function publishEvalDataset(payload: {
  kbId: string;
  expectedVersionNo: string;
}) {
  return read(() =>
    request<unknown>(`${BASE}/publishDataset`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
    }),
  );
}

export function createEvalRun(payload: EvalCreateRunPayload) {
  return read(() =>
    request<EvalCreateRunResult>(`${BASE}/createRun`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
    }),
  );
}

export function queryEvalRun(runId: string) {
  return read(() =>
    request<EvalRunDetail>(`${BASE}/queryRun`, {
      method: 'get',
      params: { runId },
      headers: tenantHeaders(),
    }),
  );
}

export function pageEvalCaseResults(data: EvalCasePagePayload) {
  return read(() =>
    request<EvalPageResult<EvalCaseResultRecord>>(`${BASE}/pageCaseResults`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function listEvalBadcases(kbId: string, status?: string, stageCode?: string) {
  return read(() =>
    request<
      EvalPageResult<EvalBadcaseRecord> | EvalBadcaseRecord[]
    >(`${BASE}/listBadcases`, {
      method: 'get',
      params: {
        kbId,
        ...(status ? { status } : {}),
        ...(stageCode ? { stageCode } : {}),
      },
      headers: tenantHeaders(),
    }),
  );
}

export function queryEvalTrustEvidence(runId: string) {
  return read(() =>
    request<EvalTrustEvidence | EvalEvidenceItem[]>(`${BASE}/queryTrustEvidence`, {
      method: 'get',
      params: { runId },
      headers: tenantHeaders(),
    }),
  );
}

export function updateEvalBadcase(payload: {
  badcaseId: string;
  status: string;
  owner: string;
  note: string;
}) {
  return read(() =>
    request<unknown>(`${BASE}/updateBadcase`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
    }),
  );
}
