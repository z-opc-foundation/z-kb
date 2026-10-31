import AppModal from '@/components/app-modal';
import { Can } from '@/components/auth';
import { confirmAction } from '@/components/confirm';
import Icon from '@/components/icon';
import {
  createAiSkill,
  getAiSkillUsage,
  listAiSkills,
  listAiTools,
  publishAiSkill,
  removeAiSkill,
  updateAiSkill,
  type AiSkillRecord,
  type AiStatus,
  type AiToolRecord,
  type AiUsageRecord,
} from '@/services/ai';
import {
  AiEmpty,
  AiFailed,
  AiLoading,
  AiRuntimeTag,
  AiStatusTag,
  AI_CODE_HINT,
  AI_STATUS_OPTIONS,
  MultiPick,
  aiCodeError,
  fmtAiTime,
  useAiRuntimeStatus,
} from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import { toast } from '@/utils/toast';
import { useEffect, useMemo, useState } from 'react';

function SkillFormModal({
  mode,
  skill,
  tools,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  skill?: AiSkillRecord;
  tools: AiToolRecord[];
  onClose: () => void;
  onSaved: (skill: AiSkillRecord) => void;
}) {
  const [code, setCode] = useState(skill?.code || '');
  const [name, setName] = useState(skill?.name || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [prompt, setPrompt] = useState(skill?.prompt || '');
  const [toolCodes, setToolCodes] = useState<string[]>(skill?.toolCodes || []);
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
      prompt: prompt.trim() || undefined,
      toolCodes,
    };
    const result =
      mode === 'create'
        ? await createAiSkill(payload)
        : await updateAiSkill(payload);
    setSaving(false);
    if (result) {
      onSaved(result);
    }
  };

  return (
    <AppModal
      icon="sparkles"
      title={mode === 'create' ? '新建技能' : `编辑 · ${skill?.name || ''}`}
      width={760}
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
              placeholder="如 citation_answer"
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="help">
              {mode === 'edit'
                ? '编码不可修改'
                : `唯一编码，智能体按编码引用；${AI_CODE_HINT}`}
            </span>
          </div>
          <div className="field">
            <label>
              名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={name}
              placeholder="如 带引用回答"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>描述</label>
            <input
              className="input"
              value={description}
              placeholder="一句话说明这个技能解决什么"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>提示词</label>
            <textarea
              className="textarea"
              rows={6}
              value={prompt}
              placeholder="例如：回答中的结论使用 [1]、[2] 标注来源；结尾输出“资料来源”清单。"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <span className="help">为空时不能发布；草稿可先保存。</span>
          </div>
          <div className="field span-2">
            <label>建议工具</label>
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
          </div>
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
            {saving ? (
              <span className="spinner" />
            ) : (
              <Icon name="check" size={13} />
            )}
            {mode === 'create' ? '创建草稿' : '保存'}
          </button>
        </>
      }
    />
  );
}

function SkillUsageModal({
  skill,
  onClose,
}: {
  skill: AiSkillRecord;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<AiUsageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    getAiSkillUsage(skill.code).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        return;
      }
      setUsage(result);
    });
    return () => {
      alive = false;
    };
  }, [skill.code]);

  return (
    <AppModal
      icon="link"
      title={`引用关系 · ${skill.name}`}
      width={560}
      onClose={onClose}
      body={
        loading ? (
          <AiLoading text="正在查询引用关系…" />
        ) : failed ? (
          <div className="empty">
            <b>引用关系加载失败</b>
            <p>接口返回异常，请稍后重试。</p>
          </div>
        ) : (
          <div className="ai-usage-block">
            <h4>引用该技能的智能体（{usage?.agentCodes.length || 0}）</h4>
            {usage?.agentCodes.length ? (
              <div className="ai-usage-list">
                {usage.agentCodes.map((code) => (
                  <span className="tag blue" key={code}>
                    {code}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )
      }
      footRight={
        <button className="btn" type="button" onClick={onClose}>
          关闭
        </button>
      }
    />
  );
}

export default function AiSkillsPage() {
  const [records, setRecords] = useState<AiSkillRecord[]>([]);
  const [tools, setTools] = useState<AiToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | AiStatus>('all');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{
    mode: 'create' | 'edit';
    skill?: AiSkillRecord;
  } | null>(null);
  const [usageTarget, setUsageTarget] = useState<AiSkillRecord | null>(null);
  const runtime = useAiRuntimeStatus();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([listAiSkills(), listAiTools()]).then(
      ([skillList, toolList]) => {
        if (!alive) {
          return;
        }
        setLoading(false);
        if (skillList === undefined) {
          setFailed(true);
          setRecords([]);
        } else {
          setRecords(skillList);
        }
        setTools(toolList || []);
      },
    );
    return () => {
      alive = false;
    };
  }, [tick]);

  const toolNames = useMemo(() => {
    const map = new Map<string, string>();
    tools.forEach((tool) => map.set(tool.code, tool.name));
    return map;
  }, [tools]);

  const counts = useMemo(
    () => ({
      all: records.length,
      published: records.filter((item) => item.status === 'published').length,
      draft: records.filter((item) => item.status === 'draft').length,
      paused: 0,
    }),
    [records],
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (status !== 'all' && item.status !== status) {
        return false;
      }
      if (!q) {
        return true;
      }
      return `${item.code} ${item.name} ${item.description || ''} ${
        item.prompt || ''
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [keyword, records, status]);

  const refresh = () => setTick((value) => value + 1);

  const onSaved = (saved: AiSkillRecord) => {
    setForm(null);
    toast(
      form?.mode === 'create' ? '已新建技能' : '已保存技能',
      `${saved.name} · v${saved.version ?? 1}`,
      'success',
    );
    refresh();
  };

  const publish = async (skill: AiSkillRecord) => {
    const result = await publishAiSkill(skill.code);
    if (result) {
      toast('已发布技能', `${result.name} · v${result.publishedVersion ?? result.version ?? 1}`, 'success');
      refresh();
    }
  };

  const remove = async (skill: AiSkillRecord) => {
    const ok = await confirmAction({
      title: `删除技能「${skill.name}」？`,
      sub: '仍被智能体引用时后端会拒绝。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    const result = await removeAiSkill(skill.code);
    if (result !== undefined) {
      toast('已删除技能', skill.name, 'success');
      refresh();
    }
  };

  return (
    <div className="view ai-list-page">
      {loading ? (
        <section className="panel">
          <AiLoading text="正在加载技能定义…" />
        </section>
      ) : failed ? (
        <section className="panel">
          <AiFailed
            title="技能列表加载失败"
            onRetry={refresh}
          />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="sparkles" size={14} />
              技能
              <span className="hint">
                {filtered.length} / {records.length}
              </span>
            </h3>
            <div className="row" style={{ gap: 6 }}>
              <AiRuntimeTag status={runtime} />
              <button className="btn sm ghost" type="button" onClick={refresh}>
                <Icon name="refresh" size={13} />
                刷新
              </button>
              <Can code="ai.skill.manage">
                <button
                  className="btn sm primary"
                  type="button"
                  onClick={() => setForm({ mode: 'create' })}
                >
                  <Icon name="plus" size={13} />
                  新建技能
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
                  placeholder="搜索编码、名称、描述或提示词"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <div className="segmented sm">
                {AI_STATUS_OPTIONS.filter(
                  (option) => option.value !== 'paused',
                ).map((option) => (
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
                已发布 {counts.published} · 草稿 {counts.draft}
              </span>
            </div>
          </div>

          {!filtered.length ? (
            <AiEmpty
              icon={keyword ? 'search' : 'sparkles'}
              title={keyword ? '没有匹配的技能' : '还没有技能'}
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
                  <Can code="ai.skill.manage">
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => setForm({ mode: 'create' })}
                    >
                      <Icon name="plus" size={13} />
                      新建技能
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
                    <th>技能</th>
                    <th>状态</th>
                    <th>版本</th>
                    <th>建议工具</th>
                    <th>提示词</th>
                    <th>更新时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((skill) => (
                    <tr key={skill.code}>
                      <td>
                        <div className="ai-name-cell">
                          <b>{skill.name}</b>
                          <small>{skill.code}</small>
                          {skill.description ? (
                            <span className="desc" title={skill.description}>
                              {skill.description}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <AiStatusTag
                          status={skill.status}
                          label={skill.statusLabel}
                        />
                      </td>
                      <td className="mono-sm">
                        v{skill.version ?? 1}
                        {skill.publishedVersion != null &&
                        skill.publishedVersion !== (skill.version ?? 1) ? (
                          <small className="note" style={{ display: 'block' }}>
                            已发布 v{skill.publishedVersion}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <div className="ai-binding">
                          {skill.toolCodes.length ? (
                            skill.toolCodes.map((code) => (
                              <span
                                className="tag gray sm"
                                key={code}
                                title={code}
                              >
                                {toolNames.get(code) || code}
                              </span>
                            ))
                          ) : (
                            <span className="note">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="ai-prompt-preview"
                          title={skill.prompt || '提示词为空'}
                        >
                          {skill.prompt || '提示词为空，暂不可发布'}
                        </span>
                      </td>
                      <td className="mono-sm">{fmtAiTime(skill.updateTime)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={() => setUsageTarget(skill)}
                          >
                            <Icon name="link" size={11} />
                            引用
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="编辑"
                            onClick={() => setForm({ mode: 'edit', skill })}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          {skill.status !== 'published' ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="发布"
                              onClick={() => void publish(skill)}
                            >
                              <Icon name="check" size={13} />
                            </button>
                          ) : null}
                          <button
                            className="icon-btn"
                            type="button"
                            title="删除"
                            onClick={() => void remove(skill)}
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
        <SkillFormModal
          mode={form.mode}
          skill={form.skill}
          tools={tools}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      ) : null}

      {usageTarget ? (
        <SkillUsageModal
          skill={usageTarget}
          onClose={() => setUsageTarget(null)}
        />
      ) : null}
    </div>
  );
}
