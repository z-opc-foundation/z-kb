import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import type { MaterialRecord } from '@/services/material';

export interface ***REMOVED***Overview {
  ***REMOVED***Id: string;
  fileCount: number;
  compiledCount: number;
  partialCount: number;
  notCompiledCount: number;
  wikiCount: number;
  runningTaskCount: number;
  failedCount: number;
  recentMaterials: MaterialRecord[];
  refreshedAt: string;
}

const BASE = '/***REMOVED***/v1/overview';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

/** 后端统计字段按大整数序列化，返回的是字符串；统一转成数字，避免下游做加法时拼成 "00"。 */
function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function get***REMOVED***Overview(***REMOVED***Id: string) {
  try {
    const result = await request<***REMOVED***Overview>(`${BASE}/***REMOVED***Stats`, {
      method: 'get',
      params: { ***REMOVED***Id },
      headers: tenantHeaders(),
    });
    if (!result) {
      return result;
    }
    return {
      ...result,
      fileCount: toCount(result.fileCount),
      compiledCount: toCount(result.compiledCount),
      partialCount: toCount(result.partialCount),
      notCompiledCount: toCount(result.notCompiledCount),
      wikiCount: toCount(result.wikiCount),
      runningTaskCount: toCount(result.runningTaskCount),
      failedCount: toCount(result.failedCount),
    };
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}
