import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageAuditLogs, type AuditLogRecord } from '@/services/audit';
import { useAuditStats } from './use-audit-stats';
import type { AuditAppliedFilters } from './use-audit-log';

vi.mock('@/services/audit', () => ({ pageAuditLogs: vi.fn(), getAuditLog: vi.fn() }));

const filters: AuditAppliedFilters = {
  keyword: '',
  actorId: '',
  result: 'all',
  range: 'all',
};

let seq = 0;

function record(patch: Partial<AuditLogRecord>): AuditLogRecord {
  seq += 1;
  return {
    id: String(seq),
    tenantCode: 'tenant-a',
    type: 'KB',
    actorId: 9,
    action: 'KB_CREATE',
    actionDesc: '新建知识库',
    targetMethod: 'add',
    requestUri: '/v1/kb/add',
    success: 1,
    durationMs: 10,
    createTime: '2026-10-30T10:00:00',
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuditStats', () => {
  it('聚合结果、耗时、Top 动作与操作人，并按 14 天补齐趋势', async () => {
    vi.mocked(pageAuditLogs).mockResolvedValue({
      records: [
        record({ action: 'KB_CREATE', actionDesc: '新建知识库', actorId: 9, durationMs: 10 }),
        record({ action: 'KB_CREATE', actionDesc: '新建知识库', actorId: 9, durationMs: 30 }),
        record({
          action: 'KB_REMOVE',
          actionDesc: '删除知识库',
          actorId: 8,
          type: 'SYS',
          success: 0,
          durationMs: 50,
        }),
      ],
      total: 3,
      size: 200,
      current: 1,
    });

    const { result } = renderHook(() => useAuditStats({}, filters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const stats = result.current.stats;
    expect(stats).not.toBeNull();
    expect(stats?.total).toBe(3);
    expect(stats?.scanned).toBe(3);
    expect(stats?.success).toBe(2);
    expect(stats?.failed).toBe(1);
    expect(stats?.successRate).toBe(66.7);
    expect(stats?.avgDurationMs).toBe(30);
    expect(stats?.p95DurationMs).toBe(50);
    expect(stats?.actorCount).toBe(2);
    expect(stats?.byAction[0]).toEqual({ key: '新建知识库', count: 2 });
    expect(stats?.byActor[0]).toEqual({ key: '9', count: 2 });
    expect(stats?.byType).toEqual({ sys: 1, kb: 2 });
    expect(stats?.byDay).toHaveLength(14);
    expect(pageAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ current: 1, size: 200 }),
    );
  });

  it('总数超出回扫上限时按页拉取并在 scanned 上体现取样', async () => {
    const pageRecords = (current: number, length = 200) =>
      Array.from({ length }, () =>
        record({ action: `ACT_${current}`, actionDesc: `动作 ${current}` }),
      );
    vi.mocked(pageAuditLogs)
      .mockResolvedValueOnce({ records: pageRecords(1), total: 450, size: 200, current: 1 })
      .mockResolvedValueOnce({ records: pageRecords(2), total: 450, size: 200, current: 2 })
      .mockResolvedValueOnce({ records: pageRecords(3, 50), total: 450, size: 200, current: 3 });

    const { result } = renderHook(() => useAuditStats({ type: 'KB', bizRef: 'kb-1' }, filters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats?.total).toBe(450);
    expect(result.current.stats?.scanned).toBe(450);
    expect(pageAuditLogs).toHaveBeenCalledTimes(3);
    expect(pageAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'KB', bizRef: 'kb-1', current: 3, size: 200 }),
    );
  });

  it('未启用时不请求，接口失败给出错误', async () => {
    vi.mocked(pageAuditLogs).mockResolvedValue(undefined);

    const disabled = renderHook(() => useAuditStats({}, filters, false));
    expect(pageAuditLogs).not.toHaveBeenCalled();
    disabled.unmount();

    const { result } = renderHook(() => useAuditStats({}, filters, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('统计数据加载失败，请稍后重试');
    expect(result.current.stats).toBeNull();
  });
});
