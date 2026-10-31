import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCallMonitor } from '@/pages/ai/monitor/hooks/use-call-monitor';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCallMonitor', () => {
  it('先进入加载态，再返回当前与上一周期快照', async () => {
    const { result } = renderHook(() => useCallMonitor('1h'));

    expect(result.current.loading).toBe(true);
    expect(result.current.snapshot).toBeUndefined();

    await waitFor(() => expect(result.current.snapshot).toBeDefined());
    expect(result.current.loading).toBe(false);
    expect(result.current.previous).toBeDefined();
    expect(result.current.snapshot?.events.length).toBe(
      result.current.snapshot?.stats.total,
    );
    expect(result.current.snapshot?.trend).toHaveLength(12);
    // 上一周期与当前周期时间窗不重叠
    expect(
      result.current.snapshot?.events[0]?.at,
    ).toBeGreaterThan(result.current.previous?.events[0]?.at ?? 0);
  });

  it('刷新会重新生成快照', async () => {
    const { result } = renderHook(() => useCallMonitor('24h'));
    await waitFor(() => expect(result.current.snapshot).toBeDefined());
    const first = result.current.snapshot;

    act(() => result.current.refresh());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.snapshot).not.toBe(first));
    expect(result.current.loading).toBe(false);
  });

  it('切换范围后按新范围重算趋势桶', async () => {
    const { result, rerender } = renderHook(
      ({ range }: { range: '24h' | '7d' }) => useCallMonitor(range),
      { initialProps: { range: '24h' } },
    );
    await waitFor(() =>
      expect(result.current.snapshot?.trend).toHaveLength(24),
    );

    rerender({ range: '7d' });

    await waitFor(() =>
      expect(result.current.snapshot?.trend).toHaveLength(7),
    );
    expect(result.current.loading).toBe(false);
  });

  it('卸载时清理尚未触发的定时器', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useCallMonitor('1h'));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
