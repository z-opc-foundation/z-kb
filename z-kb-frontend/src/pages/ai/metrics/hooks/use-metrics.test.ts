import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMetrics } from '@/pages/ai/metrics/hooks/use-metrics';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMetrics', () => {
  it('先进入加载态，再返回对应范围的快照', async () => {
    const { result } = renderHook(() => useMetrics('24h'));

    expect(result.current.loading).toBe(true);
    expect(result.current.snapshot).toBeUndefined();

    await waitFor(() => expect(result.current.snapshot).toBeDefined());
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot?.throughput).toHaveLength(24);
  });

  it('刷新会重新进入加载态并生成新的快照', async () => {
    const { result } = renderHook(() => useMetrics('24h'));
    await waitFor(() => expect(result.current.snapshot).toBeDefined());
    const first = result.current.snapshot;

    act(() => result.current.refresh());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.snapshot).not.toBe(first));
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot?.summary.calls).not.toBe(
      first?.summary.calls,
    );
  });

  it('切换范围后按新范围重新生成分桶', async () => {
    const { result, rerender } = renderHook(
      ({ range }: { range: '24h' | '7d' }) => useMetrics(range),
      { initialProps: { range: '24h' } },
    );
    await waitFor(() =>
      expect(result.current.snapshot?.throughput).toHaveLength(24),
    );

    rerender({ range: '7d' });

    await waitFor(() =>
      expect(result.current.snapshot?.throughput).toHaveLength(14),
    );
    expect(result.current.loading).toBe(false);
  });

  it('卸载时清理尚未触发的定时器', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useMetrics('24h'));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
