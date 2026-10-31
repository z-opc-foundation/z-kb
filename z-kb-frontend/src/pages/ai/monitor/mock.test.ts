import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  rangeSpanMs,
  type MonitorRange,
} from '@/pages/ai/monitor/mock';

const NOW = new Date('2026-10-28T10:00:00+08:00').getTime();

describe('调用监控样本聚合', () => {
  it('同一种子生成结果稳定', () => {
    const first = buildSnapshot('1h', NOW, 7);
    const second = buildSnapshot('1h', NOW, 7);
    expect(first.stats).toEqual(second.stats);
    expect(first.events.map((event) => event.id)).toEqual(
      second.events.map((event) => event.id),
    );
  });

  it('各维度口径互相对得上', () => {
    const snapshot = buildSnapshot('24h', NOW, 42);
    expect(snapshot.stats.total).toBe(snapshot.events.length);
    expect(snapshot.stats.success + snapshot.stats.failed).toBe(
      snapshot.stats.total,
    );
    expect(
      snapshot.trend.reduce((sum, point) => sum + point.total, 0),
    ).toBe(snapshot.stats.total);
    expect(
      snapshot.toolStats.reduce((sum, tool) => sum + tool.calls, 0),
    ).toBe(snapshot.stats.total);
    expect(
      snapshot.failureStats.reduce((sum, item) => sum + item.count, 0),
    ).toBe(snapshot.stats.failed);
    expect(
      Math.round(
        snapshot.failureStats.reduce((sum, item) => sum + item.share, 0),
      ),
    ).toBe(100);
  });

  it('时间桶数量与范围一致，事件不越界', () => {
    const cases: { range: MonitorRange; buckets: number }[] = [
      { range: '1h', buckets: 12 },
      { range: '24h', buckets: 24 },
      { range: '7d', buckets: 7 },
    ];
    cases.forEach(({ range, buckets }) => {
      const snapshot = buildSnapshot(range, NOW, 11);
      expect(snapshot.trend).toHaveLength(buckets);
      const span = rangeSpanMs(range);
      snapshot.events.forEach((event) => {
        expect(event.at).toBeGreaterThanOrEqual(NOW - span);
        expect(event.at).toBeLessThanOrEqual(NOW);
      });
    });
  });
});
