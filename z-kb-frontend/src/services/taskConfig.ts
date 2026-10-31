import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type TaskNatureCode = 'COMPILE' | 'WIKI' | 'EVALUATION';

export interface TaskConfigItemRecord {
  taskNature: TaskNatureCode | string;
  taskLabel: string;
  taskGroup: 'CHAIN' | 'QA' | string;
  executionMode: string;
  executor: string;
  agentCode?: string;
  model?: string;
  skills?: string;
  tools?: string;
  promptVersion?: string;
  outputContract?: string;
  timeoutSeconds: number;
  retryLimit: number;
  boundaryNote?: string;
}

export interface TaskConfigPanelRecord {
  version: string;
  publishedAt?: string;
  publishedBy?: number;
  items: TaskConfigItemRecord[];
}

export interface TaskConfigItemPayload {
  taskNature: string;
  executionMode: string;
  executor: string;
  agentCode?: string;
  model?: string;
  skills?: string;
  tools?: string;
  promptVersion?: string;
  outputContract?: string;
  timeoutSeconds: number;
  retryLimit: number;
  boundaryNote?: string;
}

const BASE = '/future-brain/v1/taskConfig';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function getTaskConfig() {
  return call(() =>
    request<TaskConfigPanelRecord>(`${BASE}/query`, {
      method: 'get',
      headers: tenantHeaders(),
    }),
  );
}

export function publishTaskConfig(items: TaskConfigItemPayload[]) {
  return call(() =>
    request<TaskConfigPanelRecord>(`${BASE}/publish`, {
      method: 'post',
      data: { items },
      headers: tenantHeaders(),
    }),
  );
}

export function getKbTaskConfig(kbId: string) {
  return call(() =>
    request<TaskConfigPanelRecord>(`${BASE}/kb/query?kbId=${encodeURIComponent(kbId)}`, {
      method: 'get',
      headers: tenantHeaders(),
    }),
  );
}

export function publishKbTaskConfig(kbId: string, items: TaskConfigItemPayload[]) {
  return call(() =>
    request<TaskConfigPanelRecord>(`${BASE}/kb/publish`, {
      method: 'post',
      data: { kbId, items },
      headers: tenantHeaders(),
    }),
  );
}
