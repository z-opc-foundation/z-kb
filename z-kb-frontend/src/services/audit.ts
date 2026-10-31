import type { PageResult } from '@/services/knowledgeBase';
import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

/** 操作审计（sys_audit_log）查询，与后端 /v1/auditLog 对齐。 */
const BASE = '/future-brain/v1/auditLog';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

/** 日志类型：SYS-系统级 KB-知识库级 */
export type AuditLogType = 'SYS' | 'KB';

export interface AuditLogQuery {
  current?: number;
  size?: number;
  /** 匹配动作编码、操作说明、方法名与请求路径 */
  keyword?: string;
  /** 日志类型；为空表示不限 */
  type?: AuditLogType;
  /** 类型下的业务指向键，KB 日志为知识库编码 */
  bizRef?: string;
  actorId?: number;
  /** 1-成功 0-异常 */
  success?: 0 | 1;
  /** 起始时间（含），毫秒时间戳 */
  startTime?: number;
  /** 结束时间（含），毫秒时间戳 */
  endTime?: number;
}

export interface AuditLogRecord {
  /** 主键以字符串返回，避免 JS 大整数精度丢失 */
  id: string;
  tenantCode: string;
  type?: AuditLogType;
  /** 类型下的业务指向键，KB 日志为知识库编码 */
  bizRef?: string | null;
  actorId?: number | null;
  action: string;
  actionDesc?: string | null;
  targetClass?: string | null;
  targetMethod: string;
  httpMethod?: string | null;
  requestUri?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  /** 入参 JSON，已脱敏并截断；列表不返回 */
  requestParams?: string | null;
  /** 返回值 JSON，已脱敏并截断；列表不返回 */
  responseResult?: string | null;
  success: number;
  errorMessage?: string | null;
  durationMs?: number | null;
  traceId?: string | null;
  createTime: string;
}

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function pageAuditLogs(data: AuditLogQuery) {
  return call(() =>
    request<PageResult<AuditLogRecord>>(`${BASE}/page`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function getAuditLog(id: string) {
  return call(() =>
    request<AuditLogRecord | null>(`${BASE}/get`, {
      method: 'get',
      params: { id },
      headers: tenantHeaders(),
    }),
  );
}
