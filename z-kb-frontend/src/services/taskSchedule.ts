import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

/** 调度面板，与后端 /v1/task/schedule 对齐；读的是本进程连的那套 ZK。 */
const BASE = '/future-brain/v1/task/schedule';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

export interface ScheduleCluster {
  zkAddress: string;
  rootPath: string;
  baseTaskType: string;
  consoleUrl?: string | null;
}

export interface ScheduleTaskType {
  baseTaskType: string;
  /** pause / resume，与排期同时为 resume 才会真正拉数据 */
  sts: string;
  threadNumber: number;
  fetchDataNumber: number;
  fetchDataCountEachSchedule: number;
  executeNumber: number;
  sleepTimeNoData: number;
  sleepTimeInterval: number;
  heartBeatRate: number;
  judgeDeadInterval: number;
  processorType: string;
  taskKind: string;
  dealBeanName: string;
  permitRunStartTime?: string | null;
  permitRunEndTime?: string | null;
  maxTaskItemsOfOneThreadGroup: number;
  version: number;
}

export interface ScheduleStrategy {
  strategyName: string;
  sts: string;
  kind: string;
  taskName: string;
  assignNum: number;
  numOfSingleServer: number;
  ipList: string[];
  taskParameter?: string | null;
  refreshFlag?: string | null;
}

export interface ScheduleServer {
  uuid: string;
  ip: string;
  hostName: string;
  threadNum: number;
  registerTime?: string | null;
  heartBeatTime?: string | null;
  lastFetchDataTime?: string | null;
  dealInfoDesc?: string | null;
  nextRunStartTime?: string | null;
  nextRunEndTime?: string | null;
  fetchDataCount: number;
  fetchDataNum: number;
  dealDataSuccess: number;
  dealDataFail: number;
  dealSpendTime: number;
  /** 心跳超过 judgeDeadInterval 即为假 */
  alive: boolean;
}

export interface ScheduleTaskItem {
  taskItem: string;
  sts: string;
  currentScheduleServer?: string | null;
  requestScheduleServer?: string | null;
  dealDesc?: string | null;
}

export interface ScheduleOverview {
  /** ZK 读不到时为 false，message 说明原因，队列统计照常返回 */
  available: boolean;
  message?: string | null;
  cluster?: ScheduleCluster | null;
  taskType?: ScheduleTaskType | null;
  strategy?: ScheduleStrategy | null;
  servers: ScheduleServer[];
  taskItems: ScheduleTaskItem[];
  /** PENDING/QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELED/SKIPPED */
  queue: Record<string, number>;
  oldestQueuedAt?: string | null;
  /** 最早一条排队的等待秒数，没有排队为 0 */
  oldestQueuedSeconds: number;
  /** 未暂停且排队超过阈值时为 true */
  backlogWarning: boolean;
  serverTime?: string | null;
}

async function call<T>(run: () => Promise<T>, silent = false): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    if (!silent) {
      toast('请求失败', (error as Error).message || '服务器错误', 'error');
    }
    return undefined;
  }
}

export function fetchScheduleOverview(silent = false) {
  return call(
    () =>
      request<ScheduleOverview>(`${BASE}/overview`, {
        method: 'get',
        headers: tenantHeaders(),
        silent,
      }),
    silent,
  );
}

export function pauseSchedule() {
  return call(() =>
    request<ScheduleOverview>(`${BASE}/pause`, {
      method: 'post',
      headers: tenantHeaders(),
    }),
  );
}

export function resumeSchedule() {
  return call(() =>
    request<ScheduleOverview>(`${BASE}/resume`, {
      method: 'post',
      headers: tenantHeaders(),
    }),
  );
}

export interface ScheduleConfigPayload {
  threadNumber: number;
  fetchDataNumber: number;
}

export function saveScheduleConfig(payload: ScheduleConfigPayload) {
  return call(() =>
    request<ScheduleOverview>(`${BASE}/config`, {
      method: 'post',
      headers: tenantHeaders(),
      data: payload,
    }),
  );
}

export function reloadScheduleTaskItems() {
  return call(() =>
    request<ScheduleOverview>(`${BASE}/reload`, {
      method: 'post',
      headers: tenantHeaders(),
    }),
  );
}
