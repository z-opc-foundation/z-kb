import AppModal from '@/components/app-modal';
import { Can } from '@/components/auth';
import { confirmAction } from '@/components/confirm';
import Icon from '@/components/icon';
import type { KnowledgeBaseRecord } from '@/services/knowledgeBase';
import {
  createAiAgent,
  listAiAgents,
  listAiSkills,
  listAiTools,
  pauseAiAgent,
  publishAiAgent,
  removeAiAgent,
  resumeAiAgent,
  updateAiAgent,
  type AiAgentRecord,
  type AiSkillRecord,
  type AiStatus,
  type AiToolRecord,
} from '@/services/ai';
import {
  AiEmpty,
  AiFailed,
  AiLoading,
  AiRuntimeTag,
  AiStatusTag,
  AI_CODE_HINT,
  AI_STATUS_OPTIONS,
  KbSelect,
  MultiPick,
  aiCodeError,
  fmtAiTime,
  isGalaxyRuntime,
  useAiRuntimeStatus,
  useKnowledgeBaseOptions,
} from '@/pages/ai/shared';
import { AgentRunDrawer } from '@/pages/ai/agent-run-drawer';
import '@/pages/ai/ai.less';
import { toast } from '@/utils/toast';
import { useEffect, useMemo, useState } from 'react';

function AgentFormModal({
  mode,
  agent,
  skills,
  tools,
  kbs,
  kbLoading,
  remote,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  agent?: AiAgentRecord;
  skills: AiSkillRecord[];
  tools: AiToolRecord[];
  kbs: KnowledgeBaseRecord[];
  kbLoading: boolean;
  /** 定义面在 galaxy 远端：知识库/技能/工具绑定不随本页保存。 */
  remote: boolean;
  onClose: () => void;
  onSaved: (agent: AiAgentRecord) => void;
}) {
  const [code, setCode] = useState(agent?.code || '');
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [kbId, setKbId] = useState(agent?.kbId || '');
  const [skillCodes, setSkillCodes] = useState<string[]>(
    agent?.skillCodes || [],
  );
  const [toolCodes, setToolCodes] = useState<string[]>(agent?.toolCodes || []);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!nextCode || !nextName) {
      setFormError('编码与名称必填');
      return;
    }
    const codeError = aiCodeError(nextCode);
    if (codeError) {
      setFormError(codeError);
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      code: nextCode,
      name: nextName,
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      kbId: remote ? undefined : kbId || undefined,
      skillCodes: remote ? [] : skillCodes,
      toolCodes: remote ? [] : toolCodes,
    };
    const result =
      mode === 'create'
        ? await createAiAgent(payload)
        : await updateAiAgent(payload);
    setSaving(false);
    if (result) {
      onSaved(result);
    }
  };

  return (
    <AppModal
      icon="brain"
      title={mode === 'create' ? '新建智能体' : `编辑 · ${agent?.name || ''}`}
      width={780}
      onClose={onClose}
      body={
        <div className="form-grid">
          <div className="field">
            <label>
              编码<span className="req">*</span>
            </label>
            <input
              className="input"
              value={code}
              disabled={mode === 'edit'}
              placeholder="如 kb_qa_assistant"
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="help">
              {mode === 'edit'
                ? '编码不可修改'
                : `唯一编码，后续问答接口使用；${AI_CODE_HINT}`}
            </span>
          </div>
          <div className="field">
            <label>
              名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={name}
              placeholder="如 知识库问答助手"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>描述</label>
            <input
              className="input"
              value={description}
              placeholder="一句话说明适用场景"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>系统提示词</label>
            <textarea
              className="textarea"
              rows={5}
              value={systemPrompt}
              placeholder="约束回答方式，例如：任何事实性回答必须先调用知识库检索工具"
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
          </div>
          {remote ? (
            <div className="field span-2">
              <label>技能与工具</label>
              <span className="help">
                智能体定义保存在 galaxy 管理面，技能包与 HTTP 工具的绑定在 galaxy
                侧维护；本页只维护名称、描述、提示词与发布状态。
              </span>
            </div>
          ) : (
            <>
              <div className="field">
                <label>绑定知识库</label>
                <KbSelect
                  value={kbId}
                  onChange={setKbId}
                  options={kbs}
                  loading={kbLoading}
                />
                <span className="help">
                  试运行时仍可临时覆盖；knowledge_search 必须要有库
                </span>
              </div>
              <div className="field">
                <label>生效技能</label>
                <MultiPick
                  options={skills.map((skill) => ({
                    code: skill.code,
                    name: skill.name,
                    status: skill.status,
                    statusLabel: skill.statusLabel,
                  }))}
                  value={skillCodes}
                  onChange={setSkillCodes}
                  emptyText="暂无技能，先去 A-02 新建"
                />
              </div>
              <div className="field span-2">
                <label>可用工具</label>
                <MultiPick
                  options={tools.map((tool) => ({
                    code: tool.code,
                    name: tool.name,
                    status: tool.status,
                    statusLabel: tool.executable
                      ? tool.statusLabel
                      : `${tool.statusLabel} · 未接入`,
                  }))}
                  value={toolCodes}
                  onChange={setToolCodes}
                  emptyText="暂无工具"
                />
                <span className="help">
                  未发布或没有实现接入的工具会写进提示词但不会真正执行。
                </span>
              </div>
            </>
          )}
          {formError ? <div className="field span-2 error">{formError}</div> : null}
        </div>
      }
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={saving}
            onClick={submit}
          >
            {saving ? <span className="spinner" /> : <Icon name="check" size={13} />}
            {mode === 'create' ? '创建草稿' : '保存'}
          </button>
        </>
      }
    />
  );
}

export default function AiAgentsPage() {
  const [records, setRecords] = useState<AiAgentRecord[]>([]);
  const [skills, setSkills] = useState<AiSkillRecord[]>([]);
  const [tools, setTools] = useState<AiToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | AiStatus>('all');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{
    mode: 'create' | 'edit';
    agent?: AiAgentRecord;
  } | null>(null);
  const [runAgent, setRunAgent] = useState<AiAgentRecord | null>(null);
  const { kbs, loading: kbLoading } = useKnowledgeBaseOptions();
  const runtime = useAiRuntimeStatus();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([listAiAgents(), listAiSkills(), listAiTools()]).then(
      ([agentList, skillList, toolList]) => {
        if (!alive) {
          return;
        }
        setLoading(false);
        if (agentList === undefined) {
          setFailed(true);
          setRecords([]);
        } else {
          setRecords(agentList);
        }
        setSkills(skillList || []);
        setTools(toolList || []);
      },
    );
    return () => {
      alive = false;
    };
  }, [tick]);

  const skillNames = useMemo(() => {
    const map = new Map<string, string>();
    skills.forEach((skill) => map.set(skill.code, skill.name));
    return map;
  }, [skills]);
  const toolNames = useMemo(() => {
    const map = new Map<string, string>();
    tools.forEach((tool) => map.set(tool.code, tool.name));
    return map;
  }, [tools]);
  const kbNames = useMemo(() => {
    const map = new Map<string, string>();
    kbs.forEach((kb) => map.set(kb.kbId, kb.name));
    return map;
  }, [kbs]);

  const counts = useMemo(() => {
    return {
      all: records.length,
      published: records.filter((item) => item.status === 'published').length,
      draft: records.filter((item) => item.status === 'draft').length,
      paused: records.filter((item) => item.status === 'paused').length,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (status !== 'all' && item.status !== status) {
        return false;
      }
      if (!q) {
        return true;
      }
      return `${item.code} ${item.name} ${item.description || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [keyword, records, status]);

  const refresh = () => setTick((value) => value + 1);

  const runAction = async (
    action: () => Promise<AiAgentRecord | boolean | undefined>,
    title: string,
  ) => {
    const result = await action();
    if (result !== undefined) {
      const name = typeof result === 'boolean' ? '' : result.name || result.code;
      toast(title, name, 'success');
      refresh();
    }
  };

  const onSaved = (saved: AiAgentRecord) => {
    setForm(null);
    toast(
      form?.mode === 'create' ? '已新建智能体' : '已保存智能体',
      `${saved.name} · v${saved.version ?? 1}`,
      'success',
    );
    refresh();
  };

  return (
    <div className="view ai-list-page">
      {loading ? (
        <section className="panel">
          <AiLoading text="正在加载智能体、技能与工具…" />
        </section>
      ) : failed ? (
        <section className="panel">
          <AiFailed
            title="智能体列表加载失败"
            onRetry={refresh}
          />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="brain" size={14} />
              智能体
              <span className="hint">{filtered.length} / {records.length}</span>
            </h3>
            <div className="row" style={{ gap: 6 }}>
              <AiRuntimeTag status={runtime} />
              <button className="btn sm ghost" type="button" onClick={refresh}>
                <Icon name="refresh" size={13} />
                刷新
              </button>
              <Can code="ai.agent.manage">
                <button
                  className="btn sm primary"
                  type="button"
                  onClick={() => setForm({ mode: 'create' })}
                >
                  <Icon name="plus" size={13} />
                  新建智能体
                </button>
              </Can>
            </div>
          </div>
          <div className="table-toolbar">
            <div className="left">
              <div className="input-icon">
                <Icon name="search" size={13} />
                <input
                  className="input"
                  style={{ width: 230 }}
                  placeholder="搜索编码、名称或描述"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <div className="segmented sm">
                {AI_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={status === option.value ? 'active' : ''}
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                    <span className="tnum">
                      {option.value === 'all'
                        ? counts.all
                        : counts[option.value as AiStatus]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="right">
              <span className="note">
                已发布 {counts.published} · 草稿 {counts.draft} · 暂停{' '}
                {counts.paused}
              </span>
            </div>
          </div>

          {!filtered.length ? (
            <AiEmpty
              icon={keyword ? 'search' : 'brain'}
              title={keyword ? '没有匹配的智能体' : '还没有智能体'}
              action={
                keyword ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setKeyword('');
                      setStatus('all');
                    }}
                  >
                    清空筛选
                  </button>
                ) : (
                  <Can code="ai.agent.manage">
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => setForm({ mode: 'create' })}
                    >
                      <Icon name="plus" size={13} />
                      新建智能体
                    </button>
                  </Can>
                )
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>智能体</th>
                    <th>状态</th>
                    <th>版本</th>
                    <th>技能</th>
                    <th>工具</th>
                    <th>知识库</th>
                    <th>更新时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent) => (
                    <tr key={agent.code}>
                      <td>
                        <div className="ai-name-cell">
                          <b>{agent.name}</b>
                          <small>{agent.code}</small>
                          {agent.description ? (
                            <span className="desc" title={agent.description}>
                              {agent.description}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <AiStatusTag
                          status={agent.status}
                          label={agent.statusLabel}
                        />
                      </td>
                      <td className="mono-sm">
                        v{agent.version ?? 1}
                        {agent.publishedVersion != null &&
                        agent.publishedVersion !== (agent.version ?? 1) ? (
                          <small className="note" style={{ display: 'block' }}>
                            已发布 v{agent.publishedVersion}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <div className="ai-binding">
                          {agent.skillCodes.length ? (
                            agent.skillCodes.map((code) => (
                              <span
                                className="tag gray sm"
                                key={code}
                                title={code}
                              >
                                {skillNames.get(code) || code}
                              </span>
                            ))
                          ) : (
                            <span className="note">未绑定</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="ai-binding">
                          {agent.toolCodes.length ? (
                            agent.toolCodes.map((code) => {
                              const tool = tools.find(
                                (item) => item.code === code,
                              );
                              return (
                                <span
                                  className={`tag sm ${
                                    tool && !tool.executable
                                      ? 'amber'
                                      : 'blue'
                                  }`}
                                  key={code}
                                  title={code}
                                >
                                  {toolNames.get(code) || code}
                                </span>
                              );
                            })
                          ) : (
                            <span className="note">未绑定</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {agent.kbId ? (
                          <span title={agent.kbId}>
                            {kbNames.get(agent.kbId) || agent.kbId}
                          </span>
                        ) : (
                          <span className="note">试运行选择</span>
                        )}
                      </td>
                      <td className="mono-sm">{fmtAiTime(agent.updateTime)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn xs primary-soft"
                            type="button"
                            disabled={agent.status === 'paused'}
                            title={
                              agent.status === 'paused'
                                ? '已暂停，恢复后可试运行'
                                : '在知识库范围内试运行'
                            }
                            onClick={() => {
                              if (agent.status === 'paused') {
                                toast(
                                  '智能体已暂停',
                                  '恢复后才能发起问答',
                                  'info',
                                );
                                return;
                              }
                              setRunAgent(agent);
                            }}
                          >
                            <Icon name="play" size={11} />
                            试运行
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="编辑"
                            onClick={() =>
                              setForm({ mode: 'edit', agent })
                            }
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          {agent.status === 'published' ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="暂停"
                              onClick={() =>
                                void runAction(
                                  () => pauseAiAgent(agent.code),
                                  '已暂停智能体',
                                )
                              }
                            >
                              <Icon name="pause" size={13} />
                            </button>
                          ) : agent.status === 'paused' ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="恢复"
                              onClick={() =>
                                void runAction(
                                  () => resumeAiAgent(agent.code),
                                  '已恢复智能体',
                                )
                              }
                            >
                              <Icon name="refresh" size={13} />
                            </button>
                          ) : (
                            <button
                              className="icon-btn"
                              type="button"
                              title="发布"
                              onClick={() =>
                                void runAction(
                                  () => publishAiAgent(agent.code),
                                  '已发布智能体',
                                )
                              }
                            >
                              <Icon name="check" size={13} />
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            type="button"
                            title="删除"
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: `删除智能体「${agent.name}」？`,
                                sub: '删除后绑定关系一并移除。',
                                confirmText: '删除',
                              });
                              if (ok) {
                                void runAction(
                                  () => removeAiAgent(agent.code),
                                  '已删除智能体',
                                );
                              }
                            }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {form ? (
        <AgentFormModal
          mode={form.mode}
          agent={form.agent}
          skills={skills}
          tools={tools}
          kbs={kbs}
          kbLoading={kbLoading}
          remote={isGalaxyRuntime(runtime)}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      ) : null}

      {runAgent ? (
        <AgentRunDrawer
          agent={runAgent}
          skills={skills}
          tools={tools}
          runtime={runtime}
          onClose={() => setRunAgent(null)}
        />
      ) : null}
    </div>
  );
}
