import { describe, expect, it } from 'vitest';
import {
  buildMetricsSnapshot,
  type MetricsRange,
} from '@/pages/ai/metrics/mock';

const NOW = new Date('2026-10-29T10:00:00+08:00').getTime();

describe('技术指标样本', () => {
  it('同一种子生成结果稳定', () => {
    const first = buildMetricsSnapshot('24h', NOW, 7);
    const second = buildMetricsSnapshot('24h', NOW, 7);
    expect(first.summary).toEqual(second.summary);
    expect(first.models).toEqual(second.models);
  });

  it('总调用与分布口径对得上', () => {
    const snapshot = buildMetricsSnapshot('24h', NOW, 42);
    const calls = snapshot.throughput.reduce((sum, point) => sum + point.calls, 0);
    expect(snapshot.summary.calls).toBe(calls);
    // 一次请求可能同时调向量与生成模型，模型调用总量允许略高于请求量
    expect(snapshot.models.length).toBeGreaterThan(0);
    snapshot.models.forEach((model) => {
      expect(model.calls).toBeGreaterThan(0);
      expect(model.successRate).toBeGreaterThan(90);
      expect(model.successRate).toBeLessThanOrEqual(100);
    });
    expect(
      Math.round(snapshot.stages.reduce((sum, item) => sum + item.share, 0)),
    ).toBe(100);
  });

  it('分位与 SLO 判定符合阈值', () => {
    const snapshot = buildMetricsSnapshot('7d', NOW, 11);
    const { latency, slos } = snapshot;
    expect(latency.p50).toBeLessThan(latency.p90);
    expect(latency.p90).toBeLessThan(latency.p95);
    expect(latency.p95).toBeLessThan(latency.p99);
    expect(slos).toHaveLength(6);
    const p95 = slos.find((item) => item.key === 'p95');
    expect(p95?.met).toBe(latency.p95 <= 2000);
  });

  it('分桶数量与范围一致', () => {
    const cases: { range: MetricsRange; buckets: number }[] = [
      { range: '24h', buckets: 24 },
      { range: '7d', buckets: 14 },
      { range: '30d', buckets: 30 },
    ];
    cases.forEach(({ range, buckets }) => {
      expect(buildMetricsSnapshot(range, NOW, 3).throughput).toHaveLength(buckets);
    });
  });
});
