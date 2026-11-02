import Icon from '@/components/icon';
import { pageKnowledgeBase, type KnowledgeBaseRecord } from '@/services/knowledgeBase';
import {
  getAiRuntimeStatus,
  type AiRuntimeStatus,
  type AiStatus,
} from '@/services/ai';
import { useEffect, useState, type ReactNode } from 'react';

/** 与后端 AiAgentSaveRequest / AiSkillSaveRequest / AiToolRegisterRequest 的 @Pattern 保持一致。 */
const AI_CODE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{1,63}$/;

export const AI_CODE_HINT = '字母开头，仅字母、数字、下划线，2–64 位';

export function aiCodeError(code: string): string {
  return AI_CODE_PATTERN.test(code)
    ? ''
    : `编码格式不对：${AI_CODE_HINT}；中文请放在名称里`;
}

export function statusTone(status: string): string {  if (status === 'published') {
    return 'green';
  }
  if (status === 'paused') {
    return 'amber';
  }
  return 'gray';
}

export function AiStatusTag({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span className={`tag ${statusTone(status)}`}>
      {label ||
        (status === 'published'
          ? '已发布'
          : status === 'paused'
            ? '已暂停'
            : '草稿')}
    </span>
  );
}

export function useAiRuntimeStatus(): AiRuntimeStatus | undefined {
  const [status, setStatus] = useState<AiRuntimeStatus>();
  useEffect(() => {
    let alive = true;
    void getAiRuntimeStatus().then((value) => {
      if (alive && value) {
        setStatus(value);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/** 定义面落在 galaxy 远端：智能体读写走管理面，技能/工具与本地清单不同源。 */
export function isGalaxyRuntime(status?: AiRuntimeStatus): boolean {
  return Boolean(status?.runtime?.startsWith('galaxy'));
}

/** 运行时标注：真实模型显示模型名，未配置密钥时如实标注本地替身。 */
export function AiRuntimeTag({ status }: { status?: AiRuntimeStatus }) {
  if (!status) {
    return <span className="tag gray">运行时检测中</span>;
  }
  if (status.realModel) {
    return <span className="tag green">真实模型 · {status.model}</span>;
  }
  if (status.runtime === 'unknown' || !status.runtime) {
    return <span className="tag gray">运行时未知</span>;
  }
  return <span className="tag violet">本地测试替身</span>;
}

export function AiLoading({ text }: { text: string }) {
  return (
    <div className="ai-loading">
      <span className="spinner" />
      {text}
    </div>
  );
}

export function AiEmpty({
  icon = 'inbox',
  title,
  action,
}: {
  icon?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <b>{title}</b>
      {action}
    </div>
  );
}

export function AiFailed({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="alert-triangle" size={22} />
      </div>
      <b>{title}</b>
      <button className="btn" type="button" onClick={onRetry}>
        <Icon name="refresh" size={13} />
        重试
      </button>
    </div>
  );
}

/** LocalDateTime 字符串只做展示，不做时区换算。 */
export function fmtAiTime(value?: string | null): string {
  if (!value) {
    return '—';
  }
  const normalized = String(value)
    .replace('T', ' ')
    .replace(/\.\d+/, '')
    .replace(/Z$/, '');
  return normalized.slice(0, 16);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export interface PickOption {
  code: string;
  name: string;
  status?: string;
  statusLabel?: string;
}

export function MultiPick({
  options,
  value,
  onChange,
  emptyText,
}: {
  options: PickOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
}) {
  if (!options.length) {
    return <span className="note">{emptyText}</span>;
  }
  return (
    <div className="ai-multi">
      {options.map((option) => {
        const checked = value.includes(option.code);
        return (
          <label
            key={option.code}
            className={checked ? 'on' : ''}
            title={option.name}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? value.filter((item) => item !== option.code)
                    : [...value, option.code],
                )
              }
            />
            <span className="mp-name">{option.name}</span>
            <small className="mono">{option.code}</small>
            {option.status ? (
              <span className={`tag sm ${statusTone(option.status)}`}>
                {option.statusLabel}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function useKnowledgeBaseOptions() {
  const [kbs, setKbs] = useState<KnowledgeBaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    pageKnowledgeBase({ current: 1, size: 100 }).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      setKbs(result?.records || []);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  return {
    kbs,
    loading,
    reload: () => setTick((value) => value + 1),
  };
}

export function KbSelect({
  value,
  onChange,
  options,
  loading,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: KnowledgeBaseRecord[];
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      className="select"
      value={value}
      disabled={disabled || loading}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">
        {loading ? '正在加载知识库…' : '未选择知识库'}
      </option>
      {options.map((kb) => (
        <option key={kb.kbId} value={kb.kbId}>
          {kb.name}（{kb.code}）
        </option>
      ))}
    </select>
  );
}

export const AI_STATUS_OPTIONS: { value: 'all' | AiStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'paused', label: '已暂停' },
];
