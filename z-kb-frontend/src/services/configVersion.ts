import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

const BASE = '/future-brain/v1/knowledgeBase';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('操作失败', error instanceof Error ? error.message : '请求失败', 'error');
    return undefined;
  }
}

export interface ProfileVersionRecord {
  versionNo: number;
  configVersion: string;
  status: 'DRAFT' | 'CURRENT' | 'SUPERSEDED';
  presetVersion: string;
  parserPolicy: string;
  chunkingPolicy: string;
  extractionPolicy: string;
  wikiPolicy: string;
  graphPolicy: string;
  reviewPolicy: string;
  freshnessPolicy: string;
  retrievalPolicy: string;
  remark?: string | null;
  publishedBy?: number | null;
  publisherName?: string | null;
  publishedAt?: string | null;
  updateBy?: number | null;
  updateTime?: string | null;
  createTime?: string | null;
}

export interface ConfigDiffRecord {
  field: string;
  label: string;
  currentValue: string;
  draftValue: string;
  impactScope: 'FULL' | 'INCREMENTAL' | 'NONE';
  impactLabel: string;
}

export interface ConfigImpactRecord {
  rebuildMode: 'FULL' | 'INCREMENTAL' | 'NONE';
  fullRebuildCount: number;
  incrementalCount: number;
  unaffectedCount: number;
  totalMaterials: number;
  parsedMaterials: number;
  notParsedCount: number;
  notes: string[];
}

export interface ConfigValidationItem {
  key: string;
  label: string;
  ok: boolean;
  message: string;
}

export interface ConfigValidationRecord {
  valid: boolean;
  changedCount: number;
  items: ConfigValidationItem[];
}

export interface KnowledgeBaseConfigRecord {
  kbId: string;
  kbName: string;
  type: string;
  embeddingModel: string;
  canManage: boolean;
  current: ProfileVersionRecord | null;
  draft: ProfileVersionRecord | null;
  versions: ProfileVersionRecord[];
  diff: ConfigDiffRecord[];
  impact: ConfigImpactRecord;
  validation: ConfigValidationRecord;
}

export interface ConfigDraftPayload {
  kbId: string;
  presetVersion: string;
  parserPolicy: string;
  chunkingPolicy: string;
  extractionPolicy: string;
  wikiPolicy: string;
  graphPolicy: string;
  reviewPolicy: string;
  freshnessPolicy: string;
  retrievalPolicy: string;
  remark?: string;
}

export function getKnowledgeBaseConfig(kbId: string) {
  return call(() =>
    request<KnowledgeBaseConfigRecord>(`${BASE}/queryConfig`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function saveConfigDraft(payload: ConfigDraftPayload) {
  return call(() =>
    request<ProfileVersionRecord>(`${BASE}/saveConfigDraft`, {
      method: 'post',
      data: payload,
      headers: tenantHeaders(),
      timeout: 60_000,
    }),
  );
}

export function discardConfigDraft(kbId: string) {
  return call(() =>
    request<boolean>(`${BASE}/discardConfigDraft`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function validateConfigDraft(kbId: string) {
  return call(() =>
    request<ConfigValidationRecord>(`${BASE}/validateConfigDraft`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function publishConfig(kbId: string, remark?: string) {
  return call(() =>
    request<ProfileVersionRecord>(`${BASE}/publishConfig`, {
      method: 'post',
      data: { kbId, confirm: true, remark },
      headers: tenantHeaders(),
      timeout: 60_000,
    }),
  );
}

export function submitFullRebuild(kbId: string) {
  return call(() =>
    request<string>(`${BASE}/submitRebuild`, {
      method: 'post',
      data: { kbId, confirm: true },
      headers: tenantHeaders(),
      timeout: 180_000,
    }),
  );
}

export const CONFIG_FIELDS: {
  key: keyof Pick<
    ConfigDraftPayload,
    | 'presetVersion'
    | 'parserPolicy'
    | 'chunkingPolicy'
    | 'extractionPolicy'
    | 'wikiPolicy'
    | 'graphPolicy'
    | 'reviewPolicy'
    | 'freshnessPolicy'
    | 'retrievalPolicy'
  >;
  label: string;
  hint: string;
  scope: 'FULL' | 'INCREMENTAL' | 'NONE';
  multiline?: boolean;
}[] = [
  {
    key: 'presetVersion',
    label: '预设版本',
    hint: '决定解析与切块的模板基线',
    scope: 'FULL',
  },
  {
    key: 'parserPolicy',
    label: '解析策略',
    hint: '解析器与 OCR 参数',
    scope: 'FULL',
    multiline: true,
  },
  {
    key: 'chunkingPolicy',
    label: '切块策略',
    hint: '切块大小、重叠与层级',
    scope: 'FULL',
    multiline: true,
  },
  {
    key: 'extractionPolicy',
    label: '抽取策略',
    hint: '知识点与术语抽取',
    scope: 'INCREMENTAL',
    multiline: true,
  },
  {
    key: 'wikiPolicy',
    label: '编页策略',
    hint: 'Wiki 模板与编页规则',
    scope: 'INCREMENTAL',
    multiline: true,
  },
  {
    key: 'graphPolicy',
    label: '图谱策略',
    hint: '实体关系与图空间',
    scope: 'INCREMENTAL',
    multiline: true,
  },
  {
    key: 'reviewPolicy',
    label: '审核策略',
    hint: '后续审批与冲突处理',
    scope: 'NONE',
    multiline: true,
  },
  {
    key: 'freshnessPolicy',
    label: '时效策略',
    hint: '刷新节奏与过期判定',
    scope: 'NONE',
    multiline: true,
  },
  {
    key: 'retrievalPolicy',
    label: '检索策略',
    hint: '发布后线上立即生效',
    scope: 'NONE',
    multiline: true,
  },
];
