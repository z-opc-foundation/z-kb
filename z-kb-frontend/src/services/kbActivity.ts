import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';

/** 知识库活跃度（审计日志 type=***REMOVED*** 按日聚合），供列表卡片热力图异步渲染。 */
const BASE = '/***REMOVED***/v1/knowledgeBase';

export interface ***REMOVED***ActivityDay {
  /** yyyy-MM-dd */
  date: string;
  count: number;
}

/** ***REMOVED***Id -> 有操作的日期列表，无操作的库不会出现在结果里 */
export type ***REMOVED***ActivityHeatmap = Record<string, ***REMOVED***ActivityDay[]>;

export function fetch***REMOVED***ActivityHeatmap(
  ***REMOVED***Ids: string[],
  days = 168,
): Promise<***REMOVED***ActivityHeatmap> {
  return request<***REMOVED***ActivityHeatmap>(`${BASE}/activity`, {
    method: 'post',
    data: { ***REMOVED***Ids, days },
    headers: { 'X-Tenant-Code': getTenantCode() },
    silent: true,
  });
}
