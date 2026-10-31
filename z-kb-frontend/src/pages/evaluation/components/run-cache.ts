import type { EvalRunRecord } from '@/services/evaluation';
import { getTenantCode } from '@/utils/tenant';

function cacheKey(kbId: string): string {
  return `future-knowledge.eval-runs.${getTenantCode()}.${kbId}`;
}

export function readKnownRuns(kbId: string): EvalRunRecord[] {
  try {
    const raw = sessionStorage.getItem(cacheKey(kbId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as EvalRunRecord[]) : [];
  } catch (error) {
    return [];
  }
}

export function writeKnownRuns(kbId: string, runs: EvalRunRecord[]): void {
  try {
    sessionStorage.setItem(cacheKey(kbId), JSON.stringify(runs.slice(0, 30)));
  } catch (error) {
    // 会话缓存失败不影响真实查询结果
  }
}

export function mergeRunRecords(
  current: EvalRunRecord[],
  incoming: EvalRunRecord[],
): EvalRunRecord[] {
  const map = new Map<string, EvalRunRecord>();
  current.forEach((item) => map.set(item.runId, item));
  incoming.forEach((item) => {
    if (!item?.runId) {
      return;
    }
    const previous = map.get(item.runId);
    if (previous) {
      map.set(item.runId, { ...previous, ...stripEmpty(item) });
    } else {
      map.set(item.runId, stripEmpty(item));
    }
  });
  return Array.from(map.values())
    .sort((a, b) => runTime(b) - runTime(a))
    .slice(0, 30);
}

function stripEmpty(record: EvalRunRecord): EvalRunRecord {
  const next: Record<string, unknown> = { ...record };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) {
      delete next[key];
    }
  });
  return next as unknown as EvalRunRecord;
}

function runTime(record: EvalRunRecord): number {
  const value = record.finishedAt || record.startedAt;
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
