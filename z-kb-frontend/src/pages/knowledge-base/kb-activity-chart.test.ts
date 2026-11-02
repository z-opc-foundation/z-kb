import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeries } from './kb-activity-chart';

describe('活跃度曲线按周汇总', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('铺满 24 周，周日起始，今天所在周汇总到最后一桶', () => {
    const series = buildSeries(
      [
        { date: '2026-10-29', count: 3 },
        { date: '2026-10-28', count: 1 },
      ],
      24,
    );

    expect(series.buckets).toHaveLength(24);
    expect(series.buckets[0].start).toBe('2026-05-17');
    expect(new Date(`${series.buckets[0].start}T00:00:00`).getDay()).toBe(0);
    expect(series.buckets[23].start).toBe('2026-10-25');
    expect(series.buckets[23].count).toBe(4);
    expect(series.total).toBe(4);
    expect(series.max).toBe(4);
  });

  it('同一周内多天累加，跨周分开成两个点', () => {
    const series = buildSeries(
      [
        { date: '2026-10-26', count: 2 },
        { date: '2026-10-20', count: 5 },
      ],
      24,
    );

    expect(series.buckets[23]).toMatchObject({ start: '2026-10-25', count: 2 });
    expect(series.buckets[22]).toMatchObject({ start: '2026-10-18', count: 5 });
    expect(series.max).toBe(5);
    expect(series.total).toBe(7);
  });

  it('窗口外与未来日期都不计入', () => {
    const series = buildSeries(
      [
        { date: '2025-01-01', count: 9 },
        { date: '2026-10-31', count: 7 },
        { date: '2026-10-29', count: 2 },
      ],
      24,
    );

    expect(series.total).toBe(2);
    expect(series.buckets[23].count).toBe(2);
  });

  it('没有数据时总数为 0，最大值为 0', () => {
    const series = buildSeries(undefined, 24);

    expect(series.buckets).toHaveLength(24);
    expect(series.buckets.every((bucket) => bucket.count === 0)).toBe(true);
    expect(series.total).toBe(0);
    expect(series.max).toBe(0);
  });
});
