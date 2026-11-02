import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageAuditLogs, type AuditLogRecord } from '@/services/audit';
import { useAuditLog } from './use-audit-log';

vi.mock('@/services/audit', () => ({ pageAuditLogs: vi.fn(), getAuditLog: vi.fn() }));

const records = [{ id: '1' }] as AuditLogRecord[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pageAuditLogs).mockResolvedValue({
    records,
    total: 45,
    size: 20,
    current: 1,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuditLog', () => {
  it('首次加载后返回记录、总数与分页', async () => {
    const { result } = renderHook(() => useAuditLog({ type: 'KB', bizRef: 'kb-1' }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records).toEqual(records);
    expect(result.current.total).toBe(45);
    expect(result.current.pages).toBe(3);
    expect(pageAuditLogs).toHaveBeenCalledWith({
      current: 1,
      size: 20,
      keyword: undefined,
      type: 'KB',
      bizRef: 'kb-1',
      actorId: undefined,
      success: undefined,
      startTime: undefined,
    });
  });

  it('提交关键词与操作人时去空格并转数字', async () => {
    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setDraft({ keyword: ' 上传 ', actorId: '9' });
    });
    act(() => result.current.submit());

    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: '上传', actorId: 9, current: 1 }),
      ),
    );
    expect(result.current.filtered).toBe(true);
  });

  it('结果与时间范围筛选映射成接口参数', async () => {
    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.changeResult('success'));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ success: 1 }),
      ),
    );

    act(() => result.current.changeResult('failed'));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ success: 0 }),
      ),
    );

    const before = Date.now();
    act(() => result.current.changeRange('1h'));
    await waitFor(() => expect(result.current.range).toBe('1h'));
    const lastQuery = vi.mocked(pageAuditLogs).mock.calls.at(-1)?.[0];
    expect(lastQuery?.startTime).toBeGreaterThanOrEqual(before - 60 * 60 * 1000 - 1000);
    expect(lastQuery?.startTime).toBeLessThanOrEqual(Date.now());
    expect(result.current.filtered).toBe(true);
  });

  it('接口返回空时给出错误提示', async () => {
    vi.mocked(pageAuditLogs).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('审计日志加载失败，请稍后重试');
    expect(result.current.records).toEqual([]);
  });

  it('按传入的每页条数请求，页数收缩时回落到最后一页', async () => {
    const { result, rerender } = renderHook(
      ({ size }: { size: number }) => useAuditLog({ pageSize: size }),
      { initialProps: { size: 20 } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pageAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ size: 20 }));

    act(() => result.current.setPage(3));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 3, size: 20 }),
      ),
    );

    rerender({ size: 40 });
    await waitFor(() => expect(result.current.pages).toBe(2));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 2, size: 40 }),
      ),
    );
  });

  it('applied 只在提交后更新，供统计页复用同一范围', async () => {
    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setDraft({ keyword: ' 删除 ', actorId: '' }));
    expect(result.current.applied.keyword).toBe('');

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.applied.keyword).toBe('删除'));
    expect(result.current.applied.result).toBe('all');
  });

  it('分页、刷新与重置会重新请求', async () => {
    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 2 }),
      ),
    );

    const calls = vi.mocked(pageAuditLogs).mock.calls.length;
    act(() => result.current.reload());
    await waitFor(() => expect(pageAuditLogs).toHaveBeenCalledTimes(calls + 1));

    act(() => result.current.changeResult('failed'));
    await waitFor(() => expect(result.current.filtered).toBe(true));

    act(() => result.current.reset());
    await waitFor(() => expect(result.current.filtered).toBe(false));
    expect(result.current.page).toBe(1);
    expect(result.current.result).toBe('all');
    expect(result.current.range).toBe('all');
  });
});
