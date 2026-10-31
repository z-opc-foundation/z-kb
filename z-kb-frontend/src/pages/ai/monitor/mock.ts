/**
 * 调用监控的本地样本。未接入后端调用日志接口前，页面所有数字都由这里生成；
 * 刷新或切换时间范围会用不同种子重算，保证每次看到的分布略有差异。
 */

export type CallStatus = 'success' | 'failed' | 'timeout';
export type MonitorRange = '1h' | '24h' | '7d';

export interface CallEvent {
  id: string;
  at: number;
  toolCode: string;
  toolName: string;
  agentCode: string;
  agentName: string;
  status: CallStatus;
  durationMs: number;
  args: Record<string, unknown>;
  resultSummary: string;
  errorLabel?: string;
  errorMessage?: string;
}

export interface TrendPoint {
  key: string;
  label: string;
  success: number;
  failed: number;
  total: number;
}

export interface ToolStat {
  toolCode: string;
  toolName: string;
  calls: number;
  successRate: number;
  avgMs: number;
  p95Ms: number;
}

export interface MonitorStats {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgMs: number;
  p95Ms: number;
}

export interface FailureStat {
  label: string;
  count: number;
  share: number;
}

export interface MonitorSnapshot {
  events: CallEvent[];
  stats: MonitorStats;
  trend: TrendPoint[];
  toolStats: ToolStat[];
  failureStats: FailureStat[];
}

interface ToolProfile {
  code: string;
  name: string;
  weight: number;
  failRate: number;
  timeoutRate: number;
  p50: number;
  spread: number;
}

interface AgentProfile {
  code: string;
  name: string;
  weight: number;
}

const TOOL_PROFILES: ToolProfile[] = [
  {
    code: 'knowledge_search',
    name: '知识库检索',
    weight: 62,
    failRate: 0.028,
    timeoutRate: 0.009,
    p50: 420,
    spread: 1.6,
  },
  {
    code: 'future_brain_knowledge_search',
    name: '知识库检索（远端）',
    weight: 26,
    failRate: 0.048,
    timeoutRate: 0.022,
    p50: 880,
    spread: 1.4,
  },
  {
    code: 'current_time',
    name: '当前时间',
    weight: 12,
    failRate: 0.003,
    timeoutRate: 0,
    p50: 12,
    spread: 1.3,
  },
];

const AGENT_PROFILES: AgentProfile[] = [
  { code: 'agent_fb_qa_assistant', name: '知识库问答助手', weight: 55 },
  { code: 'agent_fb_wiki_compiler', name: 'Wiki 编译员', weight: 24 },
  { code: 'agent_fb_wiki_reviewer', name: 'Wiki 质量评审员', weight: 14 },
  { code: 'agent_fb_kb_operator', name: '知识库接口操作', weight: 7 },
];

const QUERIES = [
  '胸外科排班制度',
  '体检报告解读流程',
  '病案首页填写规范',
  '护理不良事件上报',
  '院感防控要求',
  '门诊预约规则',
  '药品不良反应处置',
  '交接班记录模板',
];

const KB_IDS = ['kb_thoracic_001', 'kb_guideline_002', 'kb_ops_003'];

const RANGE_CONFIG: Record<
  MonitorRange,
  { spanMs: number; buckets: number; sample: number }
> = {
  '1h': { spanMs: 60 * 60 * 1000, buckets: 12, sample: 160 },
  '24h': { spanMs: 24 * 60 * 60 * 1000, buckets: 24, sample: 620 },
  '7d': { spanMs: 7 * 24 * 60 * 60 * 1000, buckets: 7, sample: 900 },
};

export const MONITOR_RANGE_OPTIONS: { value: MonitorRange; label: string }[] = [
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
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

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function pickWeighted<T extends { weight: number }>(
  items: T[],
  rng: () => number,
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

function pickAgent(toolCode: string, rng: () => number): AgentProfile {
  const qa = AGENT_PROFILES[0];
  const operator = AGENT_PROFILES[3];
  if (toolCode === 'current_time') {
    return qa;
  }
  if (toolCode === 'future_brain_knowledge_search') {
    return pickWeighted([qa, operator], rng);
  }
  return pickWeighted(AGENT_PROFILES, rng);
}

function buildCall(
  profile: ToolProfile,
  agent: AgentProfile,
  at: number,
  status: CallStatus,
  durationMs: number,
  index: number,
  rng: () => number,
): CallEvent {
  const query = pick(QUERIES, rng);
  const kbId = pick(KB_IDS, rng);
  let args: Record<string, unknown> = {};
  let resultSummary = '';
  if (profile.code === 'current_time') {
    args = { timezone: 'Asia/Shanghai' };
    resultSummary = `${formatDayTime(at)} +08:00`;
  } else if (profile.code === 'future_brain_knowledge_search') {
    args = { kbId, query };
    resultSummary = `命中 ${1 + Math.floor(rng() * 5)} 条 · tookMs ${Math.round(durationMs * 0.92)}`;
  } else {
    args = { kbId, query, topK: 5 };
    resultSummary = `命中 ${1 + Math.floor(rng() * 6)} 条 · 扫描 ${600 + Math.floor(rng() * 1400)} 个片段`;
  }
  if (status !== 'success') {
    resultSummary = '未返回业务结果';
  }
  const errorLabel =
    status === 'timeout'
      ? '调用超时（> 8s）'
      : status === 'failed'
        ? profile.code === 'current_time'
          ? '时间服务不可用'
          : profile.code === 'future_brain_knowledge_search'
            ? '远端检索服务异常'
            : '无权限访问知识库'
        : undefined;
  const errorMessage =
    status === 'timeout'
      ? '工具调用超时：等待上游响应超过 8s 被中断'
      : status === 'failed'
        ? profile.code === 'current_time'
          ? '时间服务不可用（HTTP 503）'
          : profile.code === 'future_brain_knowledge_search'
            ? '调用 galaxy 远端工具失败：HTTP 502 Bad Gateway'
            : `检索失败：当前租户无权访问知识库 ${kbId}（kb_acl 拒绝）`
        : undefined;

  return {
    id: `req_${at.toString(36)}${index.toString(36).padStart(2, '0')}`,
    at,
    toolCode: profile.code,
    toolName: profile.name,
    agentCode: agent.code,
    agentName: agent.name,
    status,
    durationMs,
    args,
    resultSummary,
    errorLabel,
    errorMessage,
  };
}

function buildEvents(range: MonitorRange, now: number, seed: number): CallEvent[] {
  const config = RANGE_CONFIG[range];
  const rng = mulberry32(seed + range.charCodeAt(0) * 131);
  const sample = Math.round(config.sample * (0.86 + rng() * 0.26));
  const events: CallEvent[] = [];
  for (let index = 0; index < sample; index += 1) {
    const at = now - Math.floor(rng() * config.spanMs);
    const tool = pickWeighted(TOOL_PROFILES, rng);
    const agent = pickAgent(tool.code, rng);
    const roll = rng();
    const status: CallStatus =
      roll < tool.timeoutRate
        ? 'timeout'
        : roll < tool.timeoutRate + tool.failRate
          ? 'failed'
          : 'success';
    let durationMs = Math.round(tool.p50 * (0.55 + rng() * tool.spread));
    if (status === 'timeout') {
      durationMs = 8000 + Math.round(rng() * 4000);
    } else if (status === 'failed') {
      durationMs = Math.round(tool.p50 * (0.3 + rng()));
    }
    events.push(buildCall(tool, agent, at, status, durationMs, index, rng));
  }
  return events.sort((left, right) => right.at - left.at);
}

function percentile(sorted: number[], ratio: number): number {
  if (!sorted.length) {
    return 0;
  }
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  return Math.round(
    sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower),
  );
}

function buildStats(events: CallEvent[]): MonitorStats {
  const total = events.length;
  const success = events.filter((item) => item.status === 'success').length;
  const durations = events.map((item) => item.durationMs).sort((a, b) => a - b);
  const sum = durations.reduce((acc, value) => acc + value, 0);
  return {
    total,
    success,
    failed: total - success,
    successRate: total ? (success / total) * 100 : 0,
    avgMs: total ? Math.round(sum / total) : 0,
    p95Ms: percentile(durations, 0.95),
  };
}

function buildTrend(
  events: CallEvent[],
  range: MonitorRange,
  now: number,
): TrendPoint[] {
  const { spanMs, buckets } = RANGE_CONFIG[range];
  const bucketMs = spanMs / buckets;
  const start = now - spanMs;
  const points: TrendPoint[] = Array.from({ length: buckets }, (_, index) => {
    const bucketAt = start + index * bucketMs;
    return {
      key: `${range}-${index}`,
      label: range === '7d' ? formatMonthDay(bucketAt) : formatHourMinute(bucketAt),
      success: 0,
      failed: 0,
      total: 0,
    };
  });
  events.forEach((event) => {
    const index = Math.min(
      buckets - 1,
      Math.max(0, Math.floor((event.at - start) / bucketMs)),
    );
    const point = points[index];
    point.total += 1;
    if (event.status === 'success') {
      point.success += 1;
    } else {
      point.failed += 1;
    }
  });
  return points;
}

function buildToolStats(events: CallEvent[]): ToolStat[] {
  const groups = new Map<string, CallEvent[]>();
  events.forEach((event) => {
    const list = groups.get(event.toolCode);
    if (list) {
      list.push(event);
    } else {
      groups.set(event.toolCode, [event]);
    }
  });
  return Array.from(groups.entries())
    .map(([toolCode, list]) => {
      const durations = list.map((item) => item.durationMs).sort((a, b) => a - b);
      const success = list.filter((item) => item.status === 'success').length;
      return {
        toolCode,
        toolName: list[0].toolName,
        calls: list.length,
        successRate: (success / list.length) * 100,
        avgMs: Math.round(
          durations.reduce((acc, value) => acc + value, 0) / list.length,
        ),
        p95Ms: percentile(durations, 0.95),
      };
    })
    .sort((left, right) => right.calls - left.calls);
}

function buildFailureStats(events: CallEvent[]): FailureStat[] {
  const groups = new Map<string, number>();
  let total = 0;
  events.forEach((event) => {
    if (event.status === 'success') {
      return;
    }
    total += 1;
    const label = event.errorLabel || '其他错误';
    groups.set(label, (groups.get(label) || 0) + 1);
  });
  return Array.from(groups.entries())
    .map(([label, count]) => ({
      label,
      count,
      share: total ? (count / total) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count);
}

export function buildSnapshot(
  range: MonitorRange,
  now: number,
  seed: number,
): MonitorSnapshot {
  const events = buildEvents(range, now, seed);
  return {
    events,
    stats: buildStats(events),
    trend: buildTrend(events, range, now),
    toolStats: buildToolStats(events),
    failureStats: buildFailureStats(events),
  };
}

export function rangeSpanMs(range: MonitorRange): number {
  return RANGE_CONFIG[range].spanMs;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClock(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDayTime(at: number): string {
  const date = new Date(at);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatClock(at)}`;
}

function formatMonthDay(at: number): string {
  const date = new Date(at);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatHourMinute(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  success: '成功',
  failed: '失败',
  timeout: '超时',
};

export const CALL_STATUS_TONE: Record<CallStatus, string> = {
  success: 'green',
  failed: 'red',
  timeout: 'amber',
};
