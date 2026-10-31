import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';

/** 知识库活跃度（审计日志 type=KB 按日聚合），供列表卡片热力图异步渲染。 */
const BASE = '/future-brain/v1/knowledgeBase';

export interface KbActivityDay {
  /** yyyy-MM-dd */
  date: string;
  count: number;
}

/** kbId -> 有操作的日期列表，无操作的库不会出现在结果里 */
export type KbActivityHeatmap = Record<string, KbActivityDay[]>;

export function fetchKbActivityHeatmap(
  kbIds: string[],
  days = 168,
): Promise<KbActivityHeatmap> {
  return request<KbActivityHeatmap>(`${BASE}/activity`, {
    method: 'post',
    data: { kbIds, days },
    headers: { 'X-Tenant-Code': getTenantCode() },
    silent: true,
  });
}
