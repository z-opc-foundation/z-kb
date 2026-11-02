import { useCallback, useEffect, useMemo, useState } from 'react';
import { pageAuditLogs, type AuditLogRecord, type AuditLogType } from '@/services/audit';

export type AuditResultFilter = 'all' | 'success' | 'failed';

export type AuditRangeFilter = 'all' | '1h' | '24h' | '7d';

export const DEFAULT_AUDIT_PAGE_SIZE = 20;

export const AUDIT_RANGE_MS: Record<Exclude<AuditRangeFilter, 'all'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export interface AuditDraft {
  keyword: string;
  actorId: string;
}

/** 已生效的筛选条件，统计与明细共用同一套。 */
export interface AuditAppliedFilters {
  keyword: string;
  actorId: string;
  result: AuditResultFilter;
  range: AuditRangeFilter;
}

/** 调用方固定的日志范围：系统页不限类型，知识库页固定 type=KB 且带 kbId。 */
export interface AuditScope {
  type?: AuditLogType;
  bizRef?: string;
  /** 每页行数，明细页按可用高度自适应 */
  pageSize?: number;
}

const EMPTY_DRAFT: AuditDraft = { keyword: '', actorId: '' };

/** 审计日志列表：筛选项、分页与加载状态都由这里维护。 */
export function useAuditLog(scope: AuditScope = {}) {
  const { type, bizRef, pageSize = DEFAULT_AUDIT_PAGE_SIZE } = scope;
  const [draft, setDraft] = useState<AuditDraft>(EMPTY_DRAFT);
  const [keyword, setKeyword] = useState('');
  const [actorId, setActorId] = useState('');
  const [result, setResult] = useState<AuditResultFilter>('all');
  const [range, setRange] = useState<AuditRangeFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const parsedActor = Number(actorId.trim());
    const startTime = range === 'all' ? undefined : Date.now() - AUDIT_RANGE_MS[range];
    void pageAuditLogs({
      current: page,
      size: pageSize,
      keyword: keyword.trim() || undefined,
      type,
      bizRef,
      actorId: Number.isFinite(parsedActor) && parsedActor > 0 ? parsedActor : undefined,
      success: result === 'all' ? undefined : result === 'success' ? 1 : 0,
      startTime,
    })
      .then((response) => {
        if (!alive) {
          return;
        }
        if (!response) {
          setRecords([]);
          setTotal(0);
          setError('审计日志加载失败，请稍后重试');
          return;
        }
        setRecords(response.records ?? []);
        setTotal(response.total ?? 0);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [keyword, actorId, result, range, page, pageSize, reloadTick, type, bizRef]);

  const submit = useCallback(() => {
    setKeyword(draft.keyword.trim());
    setActorId(draft.actorId);
    setPage(1);
  }, [draft]);

  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setKeyword('');
    setActorId('');
    setResult('all');
    setRange('all');
    setPage(1);
  }, []);

  const changeResult = useCallback((next: AuditResultFilter) => {
    setResult(next);
    setPage(1);
  }, []);

  /** 操作人下拉选定后立即生效，与自由输入需要点「查询」不同 */
  const changeActor = useCallback((next: string) => {
    setDraft((prev) => ({ ...prev, actorId: next }));
    setActorId(next);
    setPage(1);
  }, []);

  const changeRange = useCallback((next: AuditRangeFilter) => {
    setRange(next);
    setPage(1);
  }, []);

  const reload = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // 窗口变大导致每页行数变化时，当前页可能超出总页数，回到最后一页
  useEffect(() => {
    setPage((prev) => (prev > pages ? pages : prev));
  }, [pages]);

  const filtered =
    !!keyword.trim() || !!actorId.trim() || result !== 'all' || range !== 'all';

  const applied = useMemo<AuditAppliedFilters>(
    () => ({ keyword, actorId, result, range }),
    [keyword, actorId, result, range],
  );

  return {
    draft,
    setDraft,
    submit,
    reset,
    filtered,
    applied,
    result,
    changeResult,
    changeActor,
    range,
    changeRange,
    records,
    total,
    page,
    pages,
    size: pageSize,
    setPage,
    loading,
    error,
    reload,
  };
}
