import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { pageAuditLogs, type AuditLogRecord, type AuditLogType } from '@/services/audit';
import { AUDIT_RANGE_MS, type AuditAppliedFilters } from './use-audit-log';

/** 统计一次最多回扫的记录数与单次取数条数，超出时页面上会注明取样范围。 */
const SCAN_PAGE_SIZE = 200;
const SCAN_LIMIT = 2000;
export const AUDIT_STATS_DAYS = 14;

export interface AuditStatBucket {
  key: string;
  count: number;
}

export interface AuditStatDay {
  key: string;
  label: string;
  success: number;
  failed: number;
  total: number;
}

export interface AuditStats {
  /** 匹配筛选条件的总记录数（接口 total） */
  total: number;
  /** 实际参与聚合的记录数 */
  scanned: number;
  success: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  actorCount: number;
  byDay: AuditStatDay[];
  byAction: AuditStatBucket[];
  byActor: AuditStatBucket[];
  byType: { sys: number; kb: number };
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(sorted: number[], ratio: number): number | null {
  if (!sorted.length) {
    return null;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function aggregate(rows: AuditLogRecord[], total: number): AuditStats {
  const durations = rows
    .map((row) => row.durationMs)
    .filter((value): value is number => typeof value === 'number' && value >= 0)
    .sort((a, b) => a - b);

  let failed = 0;
  let sys = 0;
  const actionCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const days = new Map<string, AuditStatDay>();

  for (let offset = AUDIT_STATS_DAYS - 1; offset >= 0; offset -= 1) {
    const day = dayjs().subtract(offset, 'day');
    days.set(day.format('YYYY-MM-DD'), {
      key: day.format('YYYY-MM-DD'),
      label: day.format('MM-DD'),
      success: 0,
      failed: 0,
      total: 0,
    });
  }

  rows.forEach((row) => {
    const isFailed = row.success === 0;
    if (isFailed) {
      failed += 1;
    }
    if (row.type === 'SYS') {
      sys += 1;
    }
    const actionKey = row.actionDesc || row.action;
    actionCounts.set(actionKey, (actionCounts.get(actionKey) || 0) + 1);
    const actorKey = row.actorId == null ? 'unknown' : String(row.actorId);
    actorCounts.set(actorKey, (actorCounts.get(actorKey) || 0) + 1);
    const day = days.get(dayjs(row.createTime).format('YYYY-MM-DD'));
    if (day) {
      day.total += 1;
      if (isFailed) {
        day.failed += 1;
      } else {
        day.success += 1;
      }
    }
  });

  const success = rows.length - failed;
  const toBuckets = (counts: Map<string, number>): AuditStatBucket[] =>
    Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'zh-Hans-CN'));

  return {
    total,
    scanned: rows.length,
    success,
    failed,
    successRate: rows.length ? Math.round((success / rows.length) * 1000) / 10 : null,
    avgDurationMs: average(durations),
    p95DurationMs: percentile(durations, 0.95),
    actorCount: actorCounts.size,
    byDay: Array.from(days.values()),
    byAction: toBuckets(actionCounts),
    byActor: toBuckets(actorCounts),
    byType: { sys, kb: rows.length - sys },
  };
}

export interface AuditStatsScope {
  type?: AuditLogType;
  bizRef?: string;
}

/** 审计统计：按当前筛选范围回扫明细后在前端聚合，避免为统计再开一套服务端接口。 */
export function useAuditStats(
  scope: AuditStatsScope,
  filters: AuditAppliedFilters,
  enabled: boolean,
) {
  const { type, bizRef } = scope;
  const { keyword, actorId, result, range } = filters;
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');

    const run = async () => {
      const rows: AuditLogRecord[] = [];
      let total = 0;
      const parsedActor = Number(actorId.trim());
      const startTime = range === 'all' ? undefined : Date.now() - AUDIT_RANGE_MS[range];
      const maxPages = Math.ceil(SCAN_LIMIT / SCAN_PAGE_SIZE);

      for (let current = 1; current <= maxPages; current += 1) {
        const response = await pageAuditLogs({
          current,
          size: SCAN_PAGE_SIZE,
          keyword: keyword.trim() || undefined,
          type,
          bizRef,
          actorId: Number.isFinite(parsedActor) && parsedActor > 0 ? parsedActor : undefined,
          success: result === 'all' ? undefined : result === 'success' ? 1 : 0,
          startTime,
        });
        if (!alive) {
          return;
        }
        if (!response) {
          setStats(null);
          setError('统计数据加载失败，请稍后重试');
          setLoading(false);
          return;
        }
        total = response.total ?? 0;
        const batch = response.records ?? [];
        rows.push(...batch);
        if (rows.length >= Math.min(total, SCAN_LIMIT) || batch.length === 0) {
          break;
        }
      }

      setStats(aggregate(rows, total));
      setLoading(false);
    };

    void run().catch(() => {
      if (alive) {
        setStats(null);
        setError('统计数据加载失败，请稍后重试');
        setLoading(false);
      }
    });

    return () => {
      alive = false;
    };
  }, [enabled, type, bizRef, keyword, actorId, result, range, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { stats, loading, error, reload };
}
