import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export interface TaskRecord {
  taskId: string;
  taskType: string;
  bizKey: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  resultSummary?: string | null;
  failureSummary?: string | null;
  materialId?: string | null;
  materialTitle?: string | null;
  createTime?: string;
  startedAt?: string;
  heartbeatAt?: string;
  finishedAt?: string;
}

export interface TaskPageResult {
  records: TaskRecord[];
  total: number;
  pageNo: number;
  pageSize: number;
}

export interface TaskPageQuery {
  kbId: string;
  taskType?: string;
  status?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface TaskSummary {
  groupTotal: number;
  jobTotal: number;
  taskTotal: number;
}

const BASE = '/future-brain/v1/taskMonitor';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

export async function pageTasks(params: TaskPageQuery): Promise<TaskPageResult | undefined> {
  try {
    return await request<TaskPageResult>(`${BASE}/page`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    });
  } catch (error) {
    toast('调度任务加载失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

/** 任务管理页签角标：一次拿组别、单任务与调度记录条数，避免为角标拉三份列表。 */
export async function getTaskSummary(kbId: string): Promise<TaskSummary | undefined> {
  try {
    return await request<TaskSummary>(`${BASE}/summary`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    });
  } catch (e) {
    // 角标是补充信息，取不到时不影响列表，也不弹提示。
    return undefined;
  }
}
