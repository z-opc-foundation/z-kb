import { createPortal } from 'react-dom';
import Icon from '@/components/icon';
import {
  getTaskConfig,
  publishTaskConfig,
  TaskConfigItemPayload,
  TaskConfigItemRecord,
  TaskConfigPanelRecord,
} from '@/services/taskConfig';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useState } from 'react';
import { formatDateTime } from '@/utils/format';

const MODE_LABEL: Record<string, string> = {
  LOCAL_PIPELINE: '本地流水线',
  AGENT: '智能体',
  ONLINE_SYNC: '在线同步',
  BATCH: '批处理',
};

const GROUPS: { code: string; label: string; hint: string }[] = [
  { code: 'CHAIN', label: '处理链路', hint: '采集、编译、Wiki、图谱、快照、重建' },
  { code: 'QA', label: '最终 QA', hint: '测评跑批' },
];

interface TaskConfigPanelProps {
  canManage: boolean;
}

function nextVersionLabel(current?: string): string {
  if (!current) {
    return '2026.10';
  }
  if (current === '2026.10') {
    return '2026.10-r2';
  }
  const matched = /^2026\.10-r(\d+)$/.exec(current);
  if (matched) {
    return `2026.10-r${Number(matched[1]) + 1}`;
  }
  return '2026.10-r2';
}

function toPayload(item: TaskConfigItemRecord): TaskConfigItemPayload {
  return {
    taskNature: item.taskNature,
    executionMode: item.executionMode,
    executor: item.executor,
    agentCode: item.agentCode,
    model: item.model,
    skills: item.skills,
    tools: item.tools,
    promptVersion: item.promptVersion,
    outputContract: item.outputContract,
    timeoutSeconds: item.timeoutSeconds,
    retryLimit: item.retryLimit,
    boundaryNote: item.boundaryNote,
  };
}

export default function TaskConfigPanel({ canManage }: TaskConfigPanelProps) {
  const [panel, setPanel] = useState<TaskConfigPanelRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<TaskConfigItemRecord | null>(null);
  const [draft, setDraft] = useState<TaskConfigItemRecord | null>(null);
  const [saving, setSaving] = useState(false);

  useEscapeKey(() => setViewing(null), !!viewing);
  useEscapeKey(() => setDraft(null), !!draft);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getTaskConfig();
    setLoading(false);
    if (!result) {
      setError('任务配置加载失败');
      return;
    }
    setPanel(result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!panel || !draft) {
      return;
    }
    if (!draft.executor.trim()) {
      toast('不能发布', '执行器不能为空', 'warn');
      return;
    }
    if (
      !Number.isFinite(draft.timeoutSeconds) ||
      draft.timeoutSeconds <= 0 ||
      draft.timeoutSeconds > 86400
    ) {
      toast('不能发布', '超时需在 1–86400 秒之间', 'warn');
      return;
    }
    if (!Number.isFinite(draft.retryLimit) || draft.retryLimit < 0 || draft.retryLimit > 5) {
      toast('不能发布', '重试次数需在 0–5 之间', 'warn');
      return;
    }
    const items = panel.items.map((item) =>
      toPayload(item.taskNature === draft.taskNature ? draft : item),
    );
    setSaving(true);
    const result = await publishTaskConfig(items);
    setSaving(false);
    if (!result) {
      return;
    }
    setPanel(result);
    setDraft(null);
    toast('已发布新版本', `${result.version} 只影响之后创建的任务`, 'success');
  };

  const patchDraft = (patch: Partial<TaskConfigItemRecord>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-body">
          <span className="note">正在加载任务配置…</span>
        </div>
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="panel">
        <div className="panel-body row between">
          <span className="note">{error || '任务配置不可用'}</span>
          <button className="btn sm" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={12} />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-config">
      <div className="row between mb-12">
        <div className="row gap-8" style={{ alignItems: 'center' }}>
          <span className="tag green mono">版本 {panel.version}</span>
          <span className="note">
            {formatDateTime(panel.publishedAt)} 发布 ·{' '}
            {panel.publishedBy ? `操作者 ${panel.publishedBy}` : '系统预置'}
          </span>
        </div>
        <span className="note">
          {canManage ? '可编辑并发布新版本' : '只读'} · 租户级配置，对所有知识库生效
        </span>
      </div>

      {GROUPS.map((group) => {
        const items = panel.items.filter((item) => item.taskGroup === group.code);
        return (
          <div className="panel mb-16" key={group.code}>
            <div className="panel-head">
              <h3>
                <Icon name={group.code === 'QA' ? 'target' : 'workflow'} size={14} />
                {group.label}
              </h3>
              <span className="hint">{group.hint}</span>
            </div>
            <div className="table-wrap">
              <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>任务性质</th>
                    <th>执行方式</th>
                    <th>执行器</th>
                    <th>智能体 / 模型</th>
                    <th>输出契约</th>
                    <th>超时 / 重试</th>
                    <th style={{ width: 130 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.taskNature}>
                      <td>
                        <b>{item.taskLabel}</b>
                        <div className="note mono-sm">{item.taskNature}</div>
                      </td>
                      <td>
                        <span className="tag gray sm">
                          {MODE_LABEL[item.executionMode] || item.executionMode}
                        </span>
                      </td>
                      <td className="mono-sm">{item.executor}</td>
                      <td className="note">
                        {item.agentCode || '—'} / {item.model || '—'}
                      </td>
                      <td className="mono-sm">{item.outputContract || '—'}</td>
                      <td className="mono-sm">
                        {item.timeoutSeconds}s / {item.retryLimit}
                      </td>
                      <td>
                        <div className="row gap-6">
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => setViewing(item)}
                          >
                            <Icon name="eye" size={12} />
                            查看
                          </button>
                          {canManage ? (
                            <button
                              className="btn sm"
                              type="button"
                              onClick={() => setDraft({ ...item })}
                            >
                              <Icon name="edit" size={12} />
                              编辑
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="callout">
        <Icon name="info" size={15} />
        <div className="ct">
          <b>任务创建时整体拷贝当前版本</b>
          <p>
            发布新版本不回溯已创建任务；单任务详情展示创建时的配置快照与来源版本。
            {canManage ? '' : '当前身份只读，编辑与发布需要任务配置管理权限。'}
          </p>
        </div>
      </div>

      {viewing
        ? createPortal(
            <div className="overlay drawer-overlay" onMouseDown={() => setViewing(null)}>
              <aside
                className="drawer task-config-drawer"
                role="dialog"
                aria-modal="true"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="drawer-head">
                  <div className="d-top">
                    <div className="d-copy">
                      <h2>{viewing.taskLabel}</h2>
                      <div className="d-sub">
                        {viewing.taskNature} ·{' '}
                        {viewing.taskGroup === 'QA' ? '最终 QA' : '处理链路'}
                      </div>
                    </div>
                    <div className="d-actions">
                      <button
                        className="close-btn"
                        type="button"
                        onClick={() => setViewing(null)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="drawer-body">
                  <dl className="kv">
                    <dt>执行方式</dt>
                    <dd>{MODE_LABEL[viewing.executionMode] || viewing.executionMode}</dd>
                    <dt>执行器</dt>
                    <dd className="mono-sm">{viewing.executor}</dd>
                    <dt>智能体</dt>
                    <dd>{viewing.agentCode || '—'}</dd>
                    <dt>模型</dt>
                    <dd>{viewing.model || '—'}</dd>
                    <dt>技能</dt>
                    <dd>{viewing.skills || '—'}</dd>
                    <dt>工具</dt>
                    <dd>{viewing.tools || '—'}</dd>
                    <dt>提示词版本</dt>
                    <dd>{viewing.promptVersion || '—'}</dd>
                    <dt>输出契约</dt>
                    <dd className="mono-sm">{viewing.outputContract || '—'}</dd>
                    <dt>超时 / 重试</dt>
                    <dd>
                      {viewing.timeoutSeconds} 秒 / {viewing.retryLimit} 次
                    </dd>
                    <dt>边界说明</dt>
                    <dd>{viewing.boundaryNote || '—'}</dd>
                  </dl>
                </div>
                <div className="drawer-foot">
                  <button className="btn" type="button" onClick={() => setViewing(null)}>
                    关闭
                  </button>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}

      {draft
        ? createPortal(
            <div className="overlay drawer-overlay" onMouseDown={() => setDraft(null)}>
              <aside
                className="drawer task-config-drawer"
                role="dialog"
                aria-modal="true"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="drawer-head">
                  <div className="d-top">
                    <div className="d-copy">
                      <h2>编辑 · {draft.taskLabel}</h2>
                      <div className="d-sub">保存即发布 {nextVersionLabel(panel.version)}</div>
                    </div>
                    <div className="d-actions">
                      <button
                        className="close-btn"
                        type="button"
                        onClick={() => setDraft(null)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
            <div className="drawer-body">
              <h3 className="drawer-section-title">基本信息</h3>
              <div className="form-grid">
                <div className="field">
                  <label>执行方式</label>
                  <select
                    className="select"
                    value={draft.executionMode}
                    onChange={(event) => patchDraft({ executionMode: event.target.value })}
                  >
                    {Object.keys(MODE_LABEL).map((mode) => (
                      <option key={mode} value={mode}>
                        {MODE_LABEL[mode]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>执行器</label>
                  <input
                    className="input"
                    value={draft.executor}
                    onChange={(event) => patchDraft({ executor: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>智能体</label>
                  <input
                    className="input"
                    value={draft.agentCode || ''}
                    onChange={(event) => patchDraft({ agentCode: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>模型</label>
                  <input
                    className="input"
                    value={draft.model || ''}
                    onChange={(event) => patchDraft({ model: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>超时（秒）</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={86400}
                    value={draft.timeoutSeconds}
                    onChange={(event) =>
                      patchDraft({ timeoutSeconds: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>重试次数</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={5}
                    value={draft.retryLimit}
                    onChange={(event) => patchDraft({ retryLimit: Number(event.target.value) })}
                  />
                </div>
              </div>

              <h3 className="drawer-section-title mt-16">高级配置</h3>
              <div className="form-grid">
                <div className="field">
                  <label>技能</label>
                  <input
                    className="input"
                    value={draft.skills || ''}
                    onChange={(event) => patchDraft({ skills: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>工具</label>
                  <input
                    className="input"
                    value={draft.tools || ''}
                    onChange={(event) => patchDraft({ tools: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>提示词版本</label>
                  <input
                    className="input"
                    value={draft.promptVersion || ''}
                    onChange={(event) => patchDraft({ promptVersion: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>输出契约</label>
                  <input
                    className="input"
                    value={draft.outputContract || ''}
                    onChange={(event) => patchDraft({ outputContract: event.target.value })}
                  />
                </div>
                <div className="field span-2">
                  <label>边界说明</label>
                  <textarea
                    className="textarea"
                    value={draft.boundaryNote || ''}
                    onChange={(event) => patchDraft({ boundaryNote: event.target.value })}
                  />
                </div>
              </div>

              <div className="callout warn mt-16">
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>发布是整版动作</b>
                  <p>
                    全部任务性质一起发布为新版本 {nextVersionLabel(panel.version)}；
                    已创建任务保留自己的快照，不随此次发布变化。
                  </p>
                </div>
              </div>
                </div>
                <div className="drawer-foot">
                  <button className="btn" type="button" onClick={() => setDraft(null)}>
                    取消
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={saving}
                    onClick={() => void publish()}
                  >
                    <Icon name="check" size={13} />
                    {saving ? '发布中…' : '保存并发布'}
                  </button>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
