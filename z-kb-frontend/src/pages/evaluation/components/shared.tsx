import Icon from '@/components/icon';
import type {
  EvalBadcaseCounts,
  EvalEvidenceItem,
  EvalMetricRecord,
  EvalNotConnected,
  EvalRunBaseline,
  EvalRunRecord,
  EvalStageRecord,
} from '@/services/evaluation';
import dayjs from 'dayjs';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';

export type StatusTone =
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'gray';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export function fmtTime(value?: string | null, fallback = '—'): string {
  if (!value) {
    return fallback;
  }
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : value;
}

export function fmtShortTime(value?: string | null, fallback = '—'): string {
  if (!value) {
    return fallback;
  }
  const date = dayjs(value);
  return date.isValid() ? date.format('MM-DD HH:mm') : value;
}

export function fmtDuration(ms?: number | null): string {
  if (ms == null || Number.isNaN(ms)) {
    return '—';
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) {
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export type NumericValue = number | string | null | undefined;

export function toNumber(value: NumericValue): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtNumber(value: NumericValue): string {
  const number = toNumber(value);
  if (number == null) {
    return '—';
  }
  if (Number.isInteger(number)) {
    return String(number);
  }
  return number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function fmtMetricValue(
  value: NumericValue,
  unit?: string | null,
): string {
  const number = toNumber(value);
  if (number == null) {
    return '—';
  }
  const text = fmtNumber(number);
  if (!unit) {
    return text;
  }
  if (unit === 'ratio') {
    return `${fmtNumber(number * 100)}%`;
  }
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

export function deltaMeta(
  current?: NumericValue,
  baseline?: NumericValue,
  unit?: string | null,
): { text: string; direction: 'up' | 'down' | 'flat' } | null {
  const from = toNumber(current);
  const base = toNumber(baseline);
  if (from == null || base == null) {
    return null;
  }
  const delta = from - base;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const percent = unit === '%' || unit === 'ratio';
  if (delta === 0) {
    return { text: `0${percent ? '%' : ''}`, direction };
  }
  const factor = unit === 'ratio' ? 100 : 1;
  const text = `${delta > 0 ? '+' : '-'}${fmtNumber(Math.abs(delta) * factor)}${
    percent ? '%' : ''
  }`;
  return { text, direction };
}

export function runStatusMeta(status?: string | null): StatusMeta {
  const key = String(status || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    QUEUED: { label: '排队中', tone: 'gray' },
    PENDING: { label: '待运行', tone: 'gray' },
    RUNNING: { label: '运行中', tone: 'blue' },
    COMPLETED: { label: '已完成', tone: 'green' },
    SUCCESS: { label: '已完成', tone: 'green' },
    SUCCEEDED: { label: '已完成', tone: 'green' },
    FAILED: { label: '失败', tone: 'red' },
    ERROR: { label: '失败', tone: 'red' },
    CANCELED: { label: '已取消', tone: 'gray' },
    CANCELLED: { label: '已取消', tone: 'gray' },
  };
  return map[key] || { label: status || '未知', tone: 'gray' };
}

export function availabilityMeta(run?: {
  runId?: string | null;
  status?: string | null;
  resultUsable?: boolean | null;
} | null): StatusMeta {
  if (!run || !run.runId) {
    return { label: '未跑批', tone: 'gray' };
  }
  const status = String(run.status || '').toUpperCase();
  if (status && status !== 'COMPLETED' && status !== 'SUCCESS' && status !== 'SUCCEEDED') {
    return runStatusMeta(status);
  }
  if (run.resultUsable === true) {
    return { label: '可用', tone: 'green' };
  }
  if (run.resultUsable === false) {
    return { label: '不可用', tone: 'amber' };
  }
  return { label: '未标注', tone: 'gray' };
}

export function datasetStatusMeta(status?: string | null): StatusMeta {
  const key = String(status || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    DRAFT: { label: '草稿', tone: 'amber' },
    FROZEN: { label: '已冻结', tone: 'blue' },
    PUBLISHED: { label: '已发布', tone: 'green' },
    ACTIVE: { label: '生效中', tone: 'green' },
    ARCHIVED: { label: '已归档', tone: 'gray' },
    DEPRECATED: { label: '已失效', tone: 'red' },
  };
  return map[key] || { label: status || '未配置', tone: 'gray' };
}

export function metricStatusMeta(
  status?: string | null,
  hasTarget = false,
): StatusMeta {
  const key = String(status || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    PASS: { label: '达标', tone: 'green' },
    PASSED: { label: '达标', tone: 'green' },
    OK: { label: '达标', tone: 'green' },
    MET: { label: '达标', tone: 'green' },
    ACHIEVED: { label: '达标', tone: 'green' },
    SUCCESS: { label: '达标', tone: 'green' },
    WARN: { label: '需关注', tone: 'amber' },
    WARNING: { label: '需关注', tone: 'amber' },
    ATTENTION: { label: '需关注', tone: 'amber' },
    FAIL: { label: '低于目标', tone: 'red' },
    FAILED: { label: '低于目标', tone: 'red' },
    MISSED: { label: '低于目标', tone: 'red' },
    BELOW: { label: '低于目标', tone: 'red' },
    NA: { label: '不适用', tone: 'gray' },
    NONE: { label: '不适用', tone: 'gray' },
    SKIP: { label: '不适用', tone: 'gray' },
    NOT_APPLICABLE: { label: '不适用', tone: 'gray' },
    PARTIAL: { label: '部分达标', tone: 'amber' },
    NOT_CONNECTED: { label: '未接入', tone: 'gray' },
  };
  return (
    map[key] || {
      label: status || (hasTarget ? '未标注' : '—'),
      tone: 'gray',
    }
  );
}

export function badcaseStatusMeta(status?: string | null): StatusMeta {
  const key = String(status || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    OPEN: { label: '待修复', tone: 'amber' },
    PENDING: { label: '待处理', tone: 'amber' },
    FIXED: { label: '已修复', tone: 'green' },
    REGRESSED: { label: '回归', tone: 'red' },
    REGRESSION: { label: '回归', tone: 'red' },
    CLOSED: { label: '已关闭', tone: 'gray' },
    IGNORED: { label: '已忽略', tone: 'gray' },
  };
  return map[key] || { label: status || '未知', tone: 'gray' };
}

export function severityMeta(severity?: string | null): StatusMeta {
  const key = String(severity || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    HIGH: { label: '高', tone: 'red' },
    CRITICAL: { label: '高', tone: 'red' },
    MEDIUM: { label: '中', tone: 'amber' },
    MIDDLE: { label: '中', tone: 'amber' },
    LOW: { label: '低', tone: 'gray' },
    高: { label: '高', tone: 'red' },
    中: { label: '中', tone: 'amber' },
    低: { label: '低', tone: 'gray' },
  };
  return map[key] || { label: severity || '未标注', tone: 'gray' };
}

export function evidenceStatusMeta(status?: string | null): StatusMeta {
  const key = String(status || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    AVAILABLE: { label: '已具备', tone: 'green' },
    READY: { label: '已具备', tone: 'green' },
    PARTIAL: { label: '部分具备', tone: 'amber' },
    PENDING: { label: '待补', tone: 'gray' },
    MISSING: { label: '缺失', tone: 'red' },
  };
  return map[key] || { label: status || '未标注', tone: 'gray' };
}

export function layerMeta(layer?: string | null): StatusMeta {
  const key = String(layer || '').toUpperCase();
  const map: Record<string, StatusMeta> = {
    CORE: { label: '核心结果', tone: 'violet' },
    PRECONDITION: { label: '前置条件', tone: 'blue' },
    DIAGNOSTIC: { label: '诊断', tone: 'cyan' },
    RUNTIME: { label: '运行', tone: 'gray' },
    STAGE: { label: '阶段', tone: 'cyan' },
  };
  return map[key] || { label: layer || '未分层', tone: 'gray' };
}

export function behaviorMeta(behavior?: string | null): StatusMeta {
  const key = String(behavior || '').toUpperCase();
  if (key === 'REFUSE' || key === 'REFUSAL' || key === 'REFUSED') {
    return { label: '拒答', tone: 'amber' };
  }
  if (key === 'ANSWER') {
    return { label: '作答', tone: 'blue' };
  }
  return { label: behavior || '未标注', tone: 'gray' };
}

export function stageStatusMeta(status?: string | null): StatusMeta {
  return metricStatusMeta(status);
}

const NOT_CONNECTED_LABELS: Record<string, string> = {
  LLM_JUDGE: 'LLM Judge',
  LLM_JUDGE_CALIBRATION: 'LLM Judge',
  JUDGE_CALIBRATION: 'LLM Judge 校准',
  MANUAL_CALIBRATION: '人工校准',
  MANUAL_SPOT_CHECK: '人工抽检',
  COST: '成本',
  COST_TRACKING: '成本',
  S8: 'S8 反馈闭环',
  S8_FEEDBACK: 'S8 反馈闭环',
  S8_FEEDBACK_LOOP: 'S8 反馈闭环',
  GRAPH_EVAL: '图谱测评',
  API_CONTRACT_EVAL: 'API 合同测评',
  HISTORY_RUNS: '历史跑批列表',
};

export interface NotConnectedEntry {
  code: string;
  label: string;
}

export function normalizeNotConnected(
  list?: EvalNotConnected[] | null,
): NotConnectedEntry[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item, index) => {
    if (typeof item === 'string') {
      return {
        code: item,
        label: NOT_CONNECTED_LABELS[item.toUpperCase()] || item,
      };
    }
    const code = String(item?.code || item?.name || `item-${index}`);
    return {
      code,
      label:
        item?.label ||
        item?.name ||
        NOT_CONNECTED_LABELS[code.toUpperCase()] ||
        code,
    };
  });
}

export function collectMetrics(run?: {
  metrics?: EvalMetricRecord[] | null;
  stages?: EvalStageRecord[] | null;
} | null): EvalMetricRecord[] {
  if (!run) {
    return [];
  }
  const result: EvalMetricRecord[] = [];
  const seen = new Set<string>();
  const push = (metric: EvalMetricRecord) => {
    const key = `${metric.stageCode || ''}::${metric.metricCode}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(metric);
  };
  (run.metrics || []).forEach(push);
  (run.stages || []).forEach((stage) => {
    (stage.metrics || []).forEach((metric) =>
      push({ ...metric, stageCode: metric.stageCode || stage.stageCode }),
    );
  });
  return result;
}

export function metricsByLayer(
  metrics: EvalMetricRecord[],
  layer: string,
): EvalMetricRecord[] {
  return metrics.filter(
    (metric) => String(metric.metricLayer || '').toUpperCase() === layer,
  );
}

export function baselineMetricMap(
  baseline?: EvalRunBaseline | null,
): Map<string, { value?: number | null; status?: string | null }> {
  const map = new Map<string, { value?: number | null; status?: string | null }>();
  (baseline?.metrics || []).forEach((metric) => {
    map.set(metric.metricCode, { value: metric.value, status: metric.status });
  });
  return map;
}

export function totalBadcases(counts?: EvalBadcaseCounts | null): number {
  if (!counts) {
    return 0;
  }
  return (Number(counts.open) || 0) + (Number(counts.fixed) || 0)
    + (Number(counts.regressed) || 0);
}

export function Tag({
  children,
  tone = 'gray',
  className = '',
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return <span className={`tag ${tone} ${className}`.trim()}>{children}</span>;
}

export function StatusTag({
  meta,
  className,
}: {
  meta: StatusMeta;
  className?: string;
}) {
  return <Tag tone={meta.tone} className={className}>{meta.label}</Tag>;
}

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  action,
  extra,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: string;
  action?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {action}
      {extra}
    </div>
  );
}

export function LoadingState({ title = '正在加载评测数据…' }: { title?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <span className="spinner" />
      </div>
      <b>{title}</b>
      <p>数据来自评测接口，空态与错误态不会用本地样本补齐。</p>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon="alert-circle"
      title={title}
      description={description}
      action={
        onRetry || action ? (
          <div className="row gap-6">
            {action}
            {onRetry ? (
              <button className="btn" type="button" onClick={onRetry}>
                <Icon name="refresh" size={13} />
                重试
              </button>
            ) : null}
          </div>
        ) : undefined
      }
    />
  );
}

export function StageFlow({
  stages,
  active,
  onSelect,
}: {
  stages: EvalStageRecord[];
  active?: string | null;
  onSelect?: (stageCode: string) => void;
}) {
  if (!stages.length) {
    return (
      <div className="note">
        本次跑批未返回阶段诊断数据。
      </div>
    );
  }
  return (
    <div className="eval-flow">
      {stages.map((stage) => {
        const meta = stageStatusMeta(stage.status);
        const metric = (stage.metrics || [])[0];
        return (
          <button
            key={stage.stageCode}
            type="button"
            className={`eval-step ${active === stage.stageCode ? 'active' : ''}`}
            onClick={() => onSelect?.(stage.stageCode)}
            title={stage.stageName || stage.stageCode}
          >
            <span className="es-top">
              <span className="es-code">{stage.stageCode}</span>
              <Tag tone={meta.tone} className="sm">
                {meta.label}
              </Tag>
            </span>
            <b>{stage.stageName || stage.stageCode}</b>
            <span className="es-metric">
              {metric
                ? fmtMetricValue(metric.value, metric.unit)
                : stage.failingCaseCount != null
                  ? `${stage.failingCaseCount} 坏例`
                  : '—'}
              <small>
                {metric
                  ? metric.metricName || metric.metricCode
                  : stage.failingCaseCount != null
                    ? '失败坏例数'
                    : '无阶段指标'}
              </small>
            </span>
            <small className={stage.failingCaseCount ? 'c-amber' : 'note'}>
              {stage.failingCaseCount != null
                ? `${stage.failingCaseCount} 条失败坏例`
                : '未返回坏例数'}
            </small>
          </button>
        );
      })}
    </div>
  );
}

export function EvidenceList({ items }: { items?: EvalEvidenceItem[] | null }) {
  if (!items?.length) {
    return (
      <div className="note">
        接口未返回证据项；不以页面硬编码状态补齐。
      </div>
    );
  }
  return (
    <div className="check-list">
      {items.map((item, index) => {
        const meta = evidenceStatusMeta(item.status);
        return (
          <div className="check-item" key={`${item.code}-${index}`}>
            <Icon
              name={
                meta.tone === 'green'
                  ? 'check-circle'
                  : meta.tone === 'amber'
                    ? 'alert-triangle'
                    : 'clock'
              }
              size={14}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between">
                <b>{item.label || item.code}</b>
                <Tag tone={meta.tone} className="sm">
                  {meta.label}
                </Tag>
              </div>
              <small>{item.detail || '未返回说明'}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NotConnectedList({ items }: { items?: EvalNotConnected[] | null }) {
  const list = normalizeNotConnected(items);
  if (!list.length) {
    return (
      <div className="note">
        暂无未接入能力记录。
      </div>
    );
  }
  return (
    <div className="tag-list">
      {list.map((item) => (
        <Tag key={item.code} tone="gray" className="sm">
          {item.label} · 未接入
        </Tag>
      ))}
    </div>
  );
}

export function DrawerShell({
  icon = 'info',
  title,
  sub,
  width = 820,
  body,
  footLeft,
  footRight,
  onClose,
}: {
  icon?: string;
  title: ReactNode;
  sub?: ReactNode;
  width?: number;
  body: ReactNode;
  footLeft?: ReactNode;
  footRight?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const style = { '--w': `${width}px` } as CSSProperties;
  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <div
        className="drawer eval-drawer"
        style={style}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name={icon} size={18} />
            </div>
            <div className="d-copy">
              <h2>{title}</h2>
              {sub ? <div className="d-sub">{sub}</div> : null}
            </div>
            <div className="d-actions">
              <button
                className="close-btn"
                type="button"
                aria-label="关闭"
                onClick={onClose}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        </div>
        <div className="drawer-body">{body}</div>
        {footLeft || footRight ? (
          <div className="drawer-foot">
            <span className="left">{footLeft}</span>
            <div className="row gap-6">{footRight}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface NormalizedKeyValue {
  label: string;
  value: string;
}

function stringifyValue(value: unknown): string {
  if (value == null || value === '') {
    return '—';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

export function normalizeKeyValues(value: unknown): NormalizedKeyValue[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const label = String(
          record.metricName ||
            record.name ||
            record.label ||
            record.metricCode ||
            record.code ||
            `#${index + 1}`,
        );
        const number = record.value;
        if (typeof number === 'number') {
          const unit = record.unit ? String(record.unit) : '';
          return { label, value: fmtMetricValue(number, unit) };
        }
        const status = record.status ? ` · ${stringifyValue(record.status)}` : '';
        return { label, value: `${stringifyValue(number)}${status}` };
      }
      return { label: `#${index + 1}`, value: stringifyValue(item) };
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(
      ([label, item]) => ({ label, value: stringifyValue(item) }),
    );
  }
  return [];
}

export interface NormalizedRetrievedItem {
  materialId?: string;
  chunkId?: string;
  title?: string;
  content?: string;
  score?: number;
  rank?: number;
}

export function normalizeRetrieved(value: unknown): NormalizedRetrievedItem[] {
  let raw: unknown = value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.hits)) {
      raw = record.hits;
    } else if (Array.isArray(record.records)) {
      raw = record.records;
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { title: stringifyValue(item), rank: index + 1 };
    }
    const record = item as Record<string, unknown>;
    return {
      materialId:
        typeof record.materialId === 'string' ? record.materialId : undefined,
      chunkId: typeof record.chunkId === 'string' ? record.chunkId : undefined,
      title:
        typeof record.materialTitle === 'string'
          ? record.materialTitle
          : typeof record.title === 'string'
            ? record.title
            : typeof record.heading === 'string'
              ? record.heading
              : undefined,
      content:
        typeof record.content === 'string'
          ? record.content
          : typeof record.snippet === 'string'
            ? record.snippet
            : undefined,
      score: typeof record.score === 'number' ? record.score : undefined,
      rank: typeof record.rank === 'number' ? record.rank : index + 1,
    };
  });
}

export function normalizeCitations(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (value == null) {
      return [];
    }
    return [stringifyValue(value)];
  }
  return value.map((item) => {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const label = record.title || record.label || record.citation || record.text;
      return label ? stringifyValue(label) : stringifyValue(item);
    }
    return stringifyValue(item);
  });
}

export interface NormalizedStageTrace {
  stageCode: string;
  stageName?: string;
  status?: string;
  detail?: string;
}

export function normalizeStageTrace(value: unknown): NormalizedStageTrace[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') {
        return { stageCode: `#${index + 1}`, detail: stringifyValue(item) };
      }
      const record = item as Record<string, unknown>;
      return {
        stageCode: String(record.stageCode || record.code || `#${index + 1}`),
        stageName: record.stageName ? String(record.stageName) : undefined,
        status: record.status ? String(record.status) : undefined,
        detail: record.detail
          ? String(record.detail)
          : record.note
            ? String(record.note)
            : undefined,
      };
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(
      ([stageCode, item]) => ({
        stageCode,
        status:
          typeof item === 'string'
            ? item
            : item && typeof item === 'object'
              ? String((item as Record<string, unknown>).status || '')
              : undefined,
        detail:
          item && typeof item === 'object'
            ? stringifyValue((item as Record<string, unknown>).detail)
            : undefined,
      }),
    );
  }
  return [];
}

export function runRecordFromBrief(
  brief: {
    runId: string;
    status?: string | null;
    resultUsable?: boolean | null;
    finishedAt?: string | null;
    durationMs?: number | null;
  },
  kbId?: string,
): EvalRunRecord {
  return {
    runId: brief.runId,
    kbId,
    status: brief.status ?? null,
    resultUsable: brief.resultUsable ?? null,
    finishedAt: brief.finishedAt ?? null,
    durationMs: brief.durationMs ?? null,
    startedAt: brief.finishedAt ?? null,
  };
}
