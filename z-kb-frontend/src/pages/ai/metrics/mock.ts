/**
 * 技术指标的本地样本。真实指标接口接入前，页面所有数字都由这里生成；
 * 切换时间范围或刷新会用不同种子重算，保证每次看到的分布略有差异。
 */

export type MetricsRange = '24h' | '7d' | '30d';

export interface MetricsSummary {
  calls: number;
  tokens: number;
  avgMs: number;
  p95Ms: number;
  successRate: number;
  retrievalHitRate: number;
  cacheHitRate: number;
  rateLimited: number;
}

export interface ThroughputPoint {
  key: string;
  label: string;
  calls: number;
}

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface LatencyStage {
  key: string;
  label: string;
  ms: number;
  share: number;
}

export interface ModelMetric {
  key: string;
  model: string;
  usage: string;
  calls: number;
  successRate: number;
  avgMs: number;
  p95Ms: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface ToolMetric {
  key: string;
  name: string;
  code: string;
  calls: number;
  successRate: number;
  avgMs: number;
  p95Ms: number;
  timeoutRate: number;
}

export interface SloItem {
  key: string;
  label: string;
  target: string;
  actual: string;
  /** 0–100，用于进度条 */
  ratio: number;
  met: boolean;
}

export interface ResourceItem {
  key: string;
  label: string;
  used: number;
  capacity: number;
  unit: string;
  note: string;
}

export interface MetricsSnapshot {
  summary: MetricsSummary;
  previous: MetricsSummary;
  throughput: ThroughputPoint[];
  latency: LatencyPercentiles;
  stages: LatencyStage[];
  models: ModelMetric[];
  tools: ToolMetric[];
  slos: SloItem[];
  resources: ResourceItem[];
}

export const METRICS_RANGE_OPTIONS: { value: MetricsRange; label: string }[] = [
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
];

const RANGE_CONFIG: Record<
  MetricsRange,
  { buckets: number; bucketMs: number; baseCalls: number }
> = {
  '24h': { buckets: 24, bucketMs: 60 * 60 * 1000, baseCalls: 540 },
  '7d': { buckets: 14, bucketMs: 12 * 60 * 60 * 1000, baseCalls: 1320 },
  '30d': { buckets: 30, bucketMs: 24 * 60 * 60 * 1000, baseCalls: 860 },
};

interface ModelProfile {
  key: string;
  model: string;
  usage: string;
  weight: number;
  p50: number;
  inputPrice: number;
  outputPrice: number;
}

const MODEL_PROFILES: ModelProfile[] = [
  {
    key: 'bge-m3',
    model: 'bge-m3',
    usage: '向量召回',
    weight: 0.34,
    p50: 168,
    inputPrice: 0.0004,
    outputPrice: 0,
  },
  {
    key: 'qwen36-flash',
    model: 'qwen3.6-flash',
    usage: 'Wiki 生成',
    weight: 0.4,
    p50: 640,
    inputPrice: 0.002,
    outputPrice: 0.006,
  },
  {
    key: 'qwen36-plus',
    model: 'qwen3.6-plus',
    usage: '长篇编译',
    weight: 0.14,
    p50: 1180,
    inputPrice: 0.008,
    outputPrice: 0.024,
  },
  {
    key: 'deepseek-v32',
    model: 'deepseek-v3.2',
    usage: '质量评审',
    weight: 0.08,
    p50: 1420,
    inputPrice: 0.004,
    outputPrice: 0.016,
  },
  {
    key: 'local-standin',
    model: 'local-standin',
    usage: '离线兜底',
    weight: 0.04,
    p50: 96,
    inputPrice: 0,
    outputPrice: 0,
  },
];

interface ToolProfile {
  key: string;
  name: string;
  code: string;
  weight: number;
  p50: number;
  timeoutRate: number;
}

const TOOL_PROFILES: ToolProfile[] = [
  {
    key: 'knowledge_search',
    name: '知识库检索',
    code: 'knowledge_search',
    weight: 0.48,
    p50: 320,
    timeoutRate: 0.008,
  },
  {
    key: 'remote_search',
    name: '知识库检索（远端）',
    code: 'future_brain_knowledge_search',
    weight: 0.22,
    p50: 860,
    timeoutRate: 0.021,
  },
  {
    key: 'current_time',
    name: '当前时间',
    code: 'current_time',
    weight: 0.1,
    p50: 12,
    timeoutRate: 0,
  },
  {
    key: 'kb_compile',
    name: 'Wiki 编译',
    code: 'kb_compile',
    weight: 0.12,
    p50: 2400,
    timeoutRate: 0.016,
  },
  {
    key: 'doc_parse',
    name: '文档解析',
    code: 'doc_parse',
    weight: 0.08,
    p50: 1800,
    timeoutRate: 0.011,
  },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng: () => number, base: number, ratio: number): number {
  return base * (1 - ratio + rng() * ratio * 2);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function bucketLabel(range: MetricsRange, at: number): string {
  const date = new Date(at);
  if (range === '24h') {
    return `${pad(date.getHours())}:00`;
  }
  if (range === '7d') {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}h`;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildThroughput(
  range: MetricsRange,
  now: number,
  rng: () => number,
): ThroughputPoint[] {
  const { buckets, bucketMs, baseCalls } = RANGE_CONFIG[range];
  return Array.from({ length: buckets }, (_, index) => {
    const at = now - (buckets - 1 - index) * bucketMs;
    // 日内波峰：9 点后爬升、14–18 点最高、凌晨最低
    const wave = 0.52 + Math.sin(((index / buckets) * 2 - 0.55) * Math.PI) * 0.38;
    const calls = Math.max(30, Math.round(jitter(rng, baseCalls * wave, 0.14)));
    return {
      key: `${range}-${index}`,
      label: bucketLabel(range, at),
      calls,
    };
  });
}

function buildSummary(
  throughput: ThroughputPoint[],
  rng: () => number,
): MetricsSummary {
  const calls = throughput.reduce((sum, point) => sum + point.calls, 0);
  const avgMs = Math.round(jitter(rng, 620, 0.16));
  return {
    calls,
    tokens: Math.round(calls * jitter(rng, 980, 0.12)),
    avgMs,
    p95Ms: Math.round(avgMs * jitter(rng, 2.9, 0.12)),
    successRate: jitter(rng, 98.7, 0.007),
    retrievalHitRate: jitter(rng, 86.4, 0.05),
    cacheHitRate: jitter(rng, 71.8, 0.09),
    rateLimited: Math.round(calls * jitter(rng, 0.0038, 0.3)),
  };
}

function buildLatency(summary: MetricsSummary): LatencyPercentiles {
  return {
    p50: Math.round(summary.avgMs * 0.72),
    p90: Math.round(summary.avgMs * 1.86),
    p95: summary.p95Ms,
    p99: Math.round(summary.p95Ms * 1.74),
  };
}

function buildStages(summary: MetricsSummary, rng: () => number): LatencyStage[] {
  const raw = [
    { key: 'rewrite', label: '查询改写', ms: jitter(rng, 62, 0.2) },
    { key: 'recall', label: '向量召回', ms: jitter(rng, 186, 0.18) },
    { key: 'rerank', label: '重排', ms: jitter(rng, 94, 0.2) },
    { key: 'context', label: '上下文拼装', ms: jitter(rng, 43, 0.25) },
    { key: 'generate', label: 'LLM 生成', ms: summary.avgMs * jitter(rng, 0.52, 0.08) },
    { key: 'format', label: '结果格式化', ms: jitter(rng, 31, 0.3) },
  ];
  const total = raw.reduce((sum, item) => sum + item.ms, 0);
  return raw.map((item) => ({
    key: item.key,
    label: item.label,
    ms: Math.round(item.ms),
    share: (item.ms / total) * 100,
  }));
}

function buildModels(
  summary: MetricsSummary,
  rng: () => number,
): ModelMetric[] {
  return MODEL_PROFILES.map((profile) => {
    const calls = Math.max(
      4,
      Math.round(summary.calls * profile.weight * jitter(rng, 1, 0.12)),
    );
    const inputTokens = Math.round(calls * jitter(rng, 1180, 0.2));
    const outputTokens =
      profile.outputPrice === 0 ? 0 : Math.round(calls * jitter(rng, 240, 0.25));
    return {
      key: profile.key,
      model: profile.model,
      usage: profile.usage,
      calls,
      successRate: jitter(rng, 98.9, 0.008),
      avgMs: Math.round(jitter(rng, profile.p50, 0.14)),
      p95Ms: Math.round(profile.p50 * jitter(rng, 2.6, 0.14)),
      inputTokens,
      outputTokens,
      cost:
        (inputTokens * profile.inputPrice + outputTokens * profile.outputPrice) /
        1000,
    };
  }).sort((left, right) => right.calls - left.calls);
}

function buildTools(summary: MetricsSummary, rng: () => number): ToolMetric[] {
  return TOOL_PROFILES.map((profile) => ({
    key: profile.key,
    name: profile.name,
    code: profile.code,
    calls: Math.max(
      3,
      Math.round(summary.calls * profile.weight * jitter(rng, 1, 0.14)),
    ),
    successRate: jitter(rng, 100 - profile.timeoutRate * 100 - 0.9, 0.008),
    avgMs: Math.round(jitter(rng, profile.p50, 0.16)),
    p95Ms: Math.round(profile.p50 * jitter(rng, 2.4, 0.16)),
    timeoutRate: profile.timeoutRate * jitter(rng, 1, 0.35) * 100,
  })).sort((left, right) => right.calls - left.calls);
}

function buildSlos(
  summary: MetricsSummary,
  latency: LatencyPercentiles,
  backlog: number,
): SloItem[] {
  const errorRate = 100 - summary.successRate;
  const availability = 100 - errorRate * 0.06;
  return [
    {
      key: 'availability',
      label: '服务可用性',
      target: '≥ 99.90%',
      actual: `${availability.toFixed(2)}%`,
      ratio: Math.min(100, (availability / 99.9) * 100),
      met: availability >= 99.9,
    },
    {
      key: 'p95',
      label: 'P95 延迟',
      target: '≤ 2,000 ms',
      actual: `${latency.p95.toLocaleString()} ms`,
      ratio: Math.min(100, (2000 / latency.p95) * 100),
      met: latency.p95 <= 2000,
    },
    {
      key: 'error',
      label: '错误率',
      target: '≤ 2.00%',
      actual: `${errorRate.toFixed(2)}%`,
      ratio: Math.min(100, (2 / Math.max(errorRate, 0.01)) * 100),
      met: errorRate <= 2,
    },
    {
      key: 'retrieval',
      label: '检索命中率',
      target: '≥ 80.00%',
      actual: `${summary.retrievalHitRate.toFixed(2)}%`,
      ratio: Math.min(100, (summary.retrievalHitRate / 80) * 100),
      met: summary.retrievalHitRate >= 80,
    },
    {
      key: 'cache',
      label: '缓存命中率',
      target: '≥ 60.00%',
      actual: `${summary.cacheHitRate.toFixed(2)}%`,
      ratio: Math.min(100, (summary.cacheHitRate / 60) * 100),
      met: summary.cacheHitRate >= 60,
    },
    {
      key: 'backlog',
      label: '队列积压',
      target: '≤ 10 条',
      actual: `${backlog} 条`,
      ratio: Math.min(100, (10 / Math.max(backlog, 1)) * 100),
      met: backlog <= 10,
    },
  ];
}

function buildResources(rng: () => number): ResourceItem[] {
  return [
    {
      key: 'cpu',
      label: '推理 CPU',
      used: Math.round(jitter(rng, 46, 0.22)),
      capacity: 100,
      unit: '%',
      note: '8 vCPU · 4 推理实例',
    },
    {
      key: 'memory',
      label: '推理内存',
      used: Math.round(jitter(rng, 63, 0.16)),
      capacity: 100,
      unit: '%',
      note: '32 GiB · 含向量缓存',
    },
    {
      key: 'concurrency',
      label: '推理并发',
      used: Math.round(jitter(rng, 74, 0.24)),
      capacity: 128,
      unit: '路',
      note: '峰值出现在 15:00',
    },
    {
      key: 'qps',
      label: '模型 QPS',
      used: Number(jitter(rng, 9.4, 0.2).toFixed(1)),
      capacity: 20,
      unit: '次/秒',
      note: '限流阈值 20 次/秒',
    },
    {
      key: 'backlog',
      label: '队列积压',
      used: Math.round(jitter(rng, 12, 0.5)),
      capacity: 60,
      unit: '条',
      note: '编译与解析共用队列',
    },
    {
      key: 'storage',
      label: '向量索引空间',
      used: Math.round(jitter(rng, 41, 0.18)),
      capacity: 100,
      unit: '%',
      note: '共 6 个 collection',
    },
  ];
}

export function buildMetricsSnapshot(
  range: MetricsRange,
  now: number,
  seed: number,
): MetricsSnapshot {
  const rng = mulberry32(seed + range.charCodeAt(0) * 131);
  const throughput = buildThroughput(range, now, rng);
  const summary = buildSummary(throughput, rng);
  const previousThroughput = buildThroughput(range, now - 1000, mulberry32(seed + 91));
  const previous = buildSummary(previousThroughput, mulberry32(seed + 17));
  const latency = buildLatency(summary);
  const resources = buildResources(rng);
  const backlog = resources.find((item) => item.key === 'backlog')?.used || 0;
  return {
    summary,
    previous,
    throughput,
    latency,
    stages: buildStages(summary, rng),
    models: buildModels(summary, rng),
    tools: buildTools(summary, rng),
    slos: buildSlos(summary, latency, backlog),
    resources,
  };
}
