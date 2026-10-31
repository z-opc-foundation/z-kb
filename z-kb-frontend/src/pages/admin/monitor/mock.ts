/**
 * 系统监测的本地样本。真实监控接口接入前，页面数字都由这里生成；
 * 切换时间范围或刷新会用不同种子重算，保证每次看到的分布略有差异。
 */

export type MonitorRange = '1h' | '24h' | '7d';
export type ServiceStatus = 'healthy' | 'degraded' | 'down';
export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertStatus = 'firing' | 'resolved';

export interface MonitorStats {
  servicesUp: number;
  servicesTotal: number;
  peakQps: number;
  p95Ms: number;
  errorRate: number;
  alertsFiring: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  ok: number;
  failed: number;
  total: number;
}

export interface ServiceHealth {
  key: string;
  name: string;
  code: string;
  group: string;
  status: ServiceStatus;
  instances: string;
  uptime: number;
  latencyMs: number;
  errorRate: number;
  version: string;
}

export interface ResourceGauge {
  key: string;
  label: string;
  used: number;
  capacity: number;
  unit: string;
  note: string;
}

export interface QueueItem {
  key: string;
  label: string;
  waiting: number;
  running: number;
  failed: number;
  capacity: number;
}

export interface EndpointMetric {
  key: string;
  method: string;
  path: string;
  qps: number;
  p95Ms: number;
  errorRate: number;
}

export interface AlertItem {
  id: string;
  level: AlertLevel;
  target: string;
  title: string;
  sinceAt: number;
  durationMin: number;
  status: AlertStatus;
}

export interface MonitorSnapshot {
  stats: MonitorStats;
  previous: MonitorStats;
  trend: TrendPoint[];
  services: ServiceHealth[];
  resources: ResourceGauge[];
  queues: QueueItem[];
  endpoints: EndpointMetric[];
  alerts: AlertItem[];
}

export const MONITOR_RANGE_OPTIONS: { value: MonitorRange; label: string }[] = [
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
];

const RANGE_CONFIG: Record<
  MonitorRange,
  { spanMs: number; buckets: number; baseQps: number }
> = {
  '1h': { spanMs: 60 * 60 * 1000, buckets: 12, baseQps: 18 },
  '24h': { spanMs: 24 * 60 * 60 * 1000, buckets: 24, baseQps: 18 },
  '7d': { spanMs: 7 * 24 * 60 * 60 * 1000, buckets: 14, baseQps: 18 },
};

interface ServiceProfile {
  key: string;
  name: string;
  code: string;
  group: string;
  version: string;
  totalInstances: number;
  latency: number;
  errorRate: number;
  degradeRate: number;
  downRate: number;
}

const SERVICE_PROFILES: ServiceProfile[] = [
  {
    key: 'gateway',
    name: '接入网关',
    code: 'kb-gateway',
    group: '接入层',
    version: 'v2.31.0',
    totalInstances: 4,
    latency: 42,
    errorRate: 0.06,
    degradeRate: 0.03,
    downRate: 0.004,
  },
  {
    key: 'kb',
    name: '知识库服务',
    code: 'kb-service',
    group: '业务服务',
    version: 'v2.31.0',
    totalInstances: 6,
    latency: 186,
    errorRate: 0.18,
    degradeRate: 0.05,
    downRate: 0.004,
  },
  {
    key: 'retrieval',
    name: '检索服务',
    code: 'kb-retrieval',
    group: '业务服务',
    version: 'v2.30.4',
    totalInstances: 4,
    latency: 124,
    errorRate: 0.14,
    degradeRate: 0.08,
    downRate: 0.004,
  },
  {
    key: 'compile',
    name: '编译执行器',
    code: 'compile-worker',
    group: '业务服务',
    version: 'v2.31.0',
    totalInstances: 6,
    latency: 780,
    errorRate: 0.42,
    degradeRate: 0.3,
    downRate: 0.008,
  },
  {
    key: 'scheduler',
    name: '调度桥接',
    code: 'cfschedule-bridge',
    group: '基础设施',
    version: 'v1.8.2',
    totalInstances: 2,
    latency: 16,
    errorRate: 0.02,
    degradeRate: 0.02,
    downRate: 0.002,
  },
  {
    key: 'ai',
    name: 'AI 网关',
    code: 'galaxy-gateway',
    group: '基础设施',
    version: 'v3.2.1',
    totalInstances: 3,
    latency: 920,
    errorRate: 0.64,
    degradeRate: 0.26,
    downRate: 0.01,
  },
  {
    key: 'oss',
    name: '对象存储',
    code: 'oss-material',
    group: '基础设施',
    version: '—',
    totalInstances: 3,
    latency: 96,
    errorRate: 0.08,
    degradeRate: 0.03,
    downRate: 0.002,
  },
  {
    key: 'mysql',
    name: '元数据库',
    code: 'mysql-kb',
    group: '数据层',
    version: '8.0.36',
    totalInstances: 2,
    latency: 22,
    errorRate: 0.03,
    degradeRate: 0.04,
    downRate: 0.001,
  },
];

interface EndpointProfile {
  key: string;
  method: string;
  path: string;
  weight: number;
  p50: number;
  errorRate: number;
}

const ENDPOINT_PROFILES: EndpointProfile[] = [
  {
    key: 'retrieve',
    method: 'POST',
    path: '/kapi/kb/retrieve',
    weight: 0.3,
    p50: 180,
    errorRate: 0.16,
  },
  {
    key: 'agent-chat',
    method: 'POST',
    path: '/kapi/agent/chat',
    weight: 0.18,
    p50: 1240,
    errorRate: 0.52,
  },
  {
    key: 'kb-page',
    method: 'GET',
    path: '/kapi/kb/page',
    weight: 0.22,
    p50: 92,
    errorRate: 0.05,
  },
  {
    key: 'material-upload',
    method: 'POST',
    path: '/kapi/material/upload',
    weight: 0.12,
    p50: 640,
    errorRate: 0.24,
  },
  {
    key: 'compile-task',
    method: 'POST',
    path: '/kapi/compile/task',
    weight: 0.1,
    p50: 380,
    errorRate: 0.3,
  },
  {
    key: 'agent-list',
    method: 'GET',
    path: '/kapi/ai/agents',
    weight: 0.08,
    p50: 210,
    errorRate: 0.08,
  },
];

const ALERT_TEMPLATES: {
  level: AlertLevel;
  target: string;
  title: string;
  status: AlertStatus;
}[] = [
  {
    level: 'warning',
    target: '对象存储',
    title: '素材上传平均耗时较基线升高 42%',
    status: 'resolved',
  },
  {
    level: 'info',
    target: '检索服务',
    title: '实例完成一次滚动重启',
    status: 'resolved',
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

function bucketLabel(range: MonitorRange, at: number): string {
  const date = new Date(at);
  if (range === '1h') {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (range === '24h') {
    return `${pad(date.getHours())}:00`;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDayTime(at: number): string {
  const date = new Date(at);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function buildTrend(
  range: MonitorRange,
  now: number,
  rng: () => number,
): TrendPoint[] {
  const { spanMs, buckets, baseQps } = RANGE_CONFIG[range];
  const bucketMs = spanMs / buckets;
  return Array.from({ length: buckets }, (_, index) => {
    const at = now - (buckets - 1 - index) * bucketMs;
    // 日内波峰：上午爬升、下午最高、凌晨最低
    const wave = 0.42 + Math.sin(((index / buckets) * 2 - 0.5) * Math.PI) * 0.42;
    const qps = Math.max(1, Math.round(jitter(rng, baseQps * wave, 0.16) * 10) / 10);
    const failed = Math.round(
      qps * (jitter(rng, 0.006, 0.6) * (index % 5 === 0 ? 1.6 : 0.8)),
    );
    return {
      key: `${range}-${index}`,
      label: bucketLabel(range, at),
      ok: Math.max(0, Math.round((qps - failed) * 10) / 10),
      failed,
      total: qps,
    };
  });
}

function buildServices(rng: () => number): ServiceHealth[] {
  return SERVICE_PROFILES.map((profile) => {
    const roll = rng();
    const status: ServiceStatus =
      roll < profile.downRate
        ? 'down'
        : roll < profile.downRate + profile.degradeRate
          ? 'degraded'
          : 'healthy';
    const up =
      status === 'healthy'
        ? profile.totalInstances
        : status === 'degraded'
          ? Math.max(1, profile.totalInstances - 1)
          : 0;
    const statusFactor = status === 'healthy' ? 1 : status === 'degraded' ? 2.2 : 9;
    return {
      key: profile.key,
      name: profile.name,
      code: profile.code,
      group: profile.group,
      status,
      instances: `${up} / ${profile.totalInstances}`,
      uptime:
        status === 'healthy'
          ? 99.9 + rng() * 0.09
          : status === 'degraded'
            ? 99.2 + rng() * 0.6
            : 96 + rng() * 2.8,
      latencyMs: Math.round(jitter(rng, profile.latency * statusFactor, 0.16)),
      errorRate: profile.errorRate * statusFactor * jitter(rng, 1, 0.4),
      version: profile.version,
    };
  });
}

function buildResources(rng: () => number): ResourceGauge[] {
  return [
    {
      key: 'cpu',
      label: '集群 CPU',
      used: Math.round(jitter(rng, 48, 0.26)),
      capacity: 100,
      unit: '%',
      note: '8 vCPU · 4 应用实例',
    },
    {
      key: 'memory',
      label: '集群内存',
      used: Math.round(jitter(rng, 66, 0.18)),
      capacity: 100,
      unit: '%',
      note: '32 GiB · 含编译工作进程',
    },
    {
      key: 'disk',
      label: '数据盘使用',
      used: Math.round(jitter(rng, 57, 0.14)),
      capacity: 100,
      unit: '%',
      note: '系统盘 500 GiB',
    },
    {
      key: 'db-pool',
      label: '数据库连接池',
      used: Math.round(jitter(rng, 74, 0.3)),
      capacity: 200,
      unit: '连接',
      note: '最大连接 200 · 等待超时 3s',
    },
  ];
}

function buildQueues(rng: () => number): QueueItem[] {
  return [
    {
      key: 'compile',
      label: '编译任务',
      waiting: Math.round(jitter(rng, 14, 0.7)),
      running: Math.round(jitter(rng, 6, 0.5)),
      failed: Math.round(jitter(rng, 1, 1)),
      capacity: 200,
    },
    {
      key: 'parse',
      label: '文档解析',
      waiting: Math.round(jitter(rng, 5, 0.8)),
      running: Math.round(jitter(rng, 3, 0.5)),
      failed: Math.round(jitter(rng, 0.4, 1)),
      capacity: 120,
    },
    {
      key: 'index',
      label: '向量索引重建',
      waiting: Math.round(jitter(rng, 2, 1)),
      running: Math.round(jitter(rng, 1, 0.5)),
      failed: 0,
      capacity: 60,
    },
    {
      key: 'evaluation',
      label: '评测执行',
      waiting: Math.round(jitter(rng, 7, 0.7)),
      running: Math.round(jitter(rng, 2, 0.5)),
      failed: Math.round(jitter(rng, 0.6, 1)),
      capacity: 80,
    },
  ];
}

function buildEndpoints(
  peakQps: number,
  rng: () => number,
): EndpointMetric[] {
  return ENDPOINT_PROFILES.map((profile) => ({
    key: profile.key,
    method: profile.method,
    path: profile.path,
    qps: Math.max(0.1, Math.round(peakQps * profile.weight * jitter(rng, 1, 0.12) * 10) / 10),
    p95Ms: Math.round(profile.p50 * jitter(rng, 2.8, 0.16)),
    errorRate: profile.errorRate * jitter(rng, 1, 0.5),
  })).sort((left, right) => right.qps - left.qps);
}

function buildAlerts(
  services: ServiceHealth[],
  queues: QueueItem[],
  now: number,
  rng: () => number,
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const compileQueue = queues.find((item) => item.key === 'compile');
  if (compileQueue && compileQueue.waiting > 10) {
    const durationMin = Math.round(jitter(rng, 42, 0.7));
    alerts.push({
      id: 'alt_compile_backlog',
      level: 'warning',
      target: '编译执行器',
      title: `编译任务积压 ${compileQueue.waiting} 条，高于 10 条阈值`,
      sinceAt: now - durationMin * 60 * 1000,
      durationMin,
      status: 'firing',
    });
  }
  services
    .filter((service) => service.status !== 'healthy')
    .forEach((service, index) => {
      const durationMin = Math.round(jitter(rng, 26 + index * 18, 0.8));
      alerts.push({
        id: `alt_${service.key}`,
        level: service.status === 'down' ? 'critical' : 'warning',
        target: service.name,
        title:
          service.status === 'down'
            ? `${service.code} 全部实例不可用`
            : `${service.code} P95 延迟 ${service.latencyMs.toLocaleString()} ms，高于基线`,
        sinceAt: now - durationMin * 60 * 1000,
        durationMin,
        status: 'firing',
      });
    });
  ALERT_TEMPLATES.forEach((template, index) => {
    const durationMin = Math.round(jitter(rng, 18 + index * 46, 0.6));
    alerts.push({
      id: `alt_history_${index}`,
      level: template.level,
      target: template.target,
      title: template.title,
      sinceAt: now - (durationMin + 120) * 60 * 1000,
      durationMin,
      status: template.status,
    });
  });
  const severity: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'firing' ? -1 : 1;
    }
    return severity[left.level] - severity[right.level];
  });
}

function buildStats(
  trend: TrendPoint[],
  services: ServiceHealth[],
  alerts: AlertItem[],
): MonitorStats {
  const total = trend.reduce((sum, point) => sum + point.total, 0);
  const failed = trend.reduce((sum, point) => sum + point.failed, 0);
  const peakQps = Math.max(0, ...trend.map((point) => point.total));
  const weightedLatency =
    services.reduce((sum, service) => sum + service.latencyMs, 0) /
    Math.max(1, services.length);
  return {
    servicesUp: services.filter((service) => service.status === 'healthy').length,
    servicesTotal: services.length,
    peakQps: Math.round(peakQps * 10) / 10,
    p95Ms: Math.round(weightedLatency * 2.3),
    errorRate: total ? (failed / total) * 100 : 0,
    alertsFiring: alerts.filter((alert) => alert.status === 'firing').length,
  };
}

function buildPrevious(stats: MonitorStats, rng: () => number): MonitorStats {
  return {
    ...stats,
    peakQps: Math.round(stats.peakQps * jitter(rng, 1, 0.09) * 10) / 10,
    p95Ms: Math.round(stats.p95Ms * jitter(rng, 1, 0.1)),
    errorRate: Math.max(0, stats.errorRate * jitter(rng, 1, 0.28)),
    alertsFiring: Math.max(
      0,
      stats.alertsFiring + (rng() > 0.5 ? 1 : -1),
    ),
  };
}

export function buildMonitorSnapshot(
  range: MonitorRange,
  now: number,
  seed: number,
): MonitorSnapshot {
  const rng = mulberry32(seed + range.charCodeAt(0) * 131);
  const trend = buildTrend(range, now, rng);
  const services = buildServices(rng);
  const peakQps = Math.max(1, ...trend.map((point) => point.total));
  const endpoints = buildEndpoints(peakQps, rng);
  const queues = buildQueues(rng);
  const alerts = buildAlerts(services, queues, now, rng);
  const stats = buildStats(trend, services, alerts);
  return {
    stats,
    previous: buildPrevious(stats, mulberry32(seed + 19)),
    trend,
    services,
    resources: buildResources(rng),
    queues,
    endpoints,
    alerts,
  };
}

export function rangeSpanMs(range: MonitorRange): number {
  return RANGE_CONFIG[range].spanMs;
}

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  healthy: '正常',
  degraded: '降级',
  down: '异常',
};

export const SERVICE_STATUS_TONE: Record<ServiceStatus, string> = {
  healthy: 'green',
  degraded: 'amber',
  down: 'red',
};

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
};

export const ALERT_LEVEL_TONE: Record<AlertLevel, string> = {
  critical: 'red',
  warning: 'amber',
  info: 'gray',
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  firing: '未恢复',
  resolved: '已恢复',
};
