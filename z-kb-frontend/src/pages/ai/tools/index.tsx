import AppModal from '@/components/app-modal';
import { confirmAction } from '@/components/confirm';
import Icon from '@/components/icon';
import {
  changeAiToolStatus,
  getAiToolUsage,
  invokeAiTool,
  listAiTools,
  registerAiTool,
  removeAiTool,
  type AiStatus,
  type AiToolInvokeResult,
  type AiToolParameter,
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
  KbSelect,
  asRecord,
  aiCodeError,
  fmtAiTime,
  textOf,
  useAiRuntimeStatus,
  useKnowledgeBaseOptions,
} from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import { toast } from '@/utils/toast';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { useEffect, useMemo, useState } from 'react';

const PARAM_TYPES = ['string', 'integer', 'number', 'boolean', 'object'];

const EMPTY_PARAM: AiToolParameter = {
  name: '',
  type: 'string',
  description: '',
  required: false,
};

function ToolRegisterModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (tool: AiToolRecord) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [risk, setRisk] = useState('low');
  const [params, setParams] = useState<AiToolParameter[]>([
    { ...EMPTY_PARAM },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const updateParam = (index: number, patch: Partial<AiToolParameter>) => {
    setParams((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

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
    const cleaned = params
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        description: (item.description || '').trim(),
      }))
      .filter((item) => item.name);
    const names = new Set(cleaned.map((item) => item.name));
    if (names.size !== cleaned.length) {
      setFormError('参数名不能重复');
      return;
    }
    setSaving(true);
    setFormError('');
    const result = await registerAiTool({
      code: nextCode,
      name: nextName,
      description: description.trim() || undefined,
      risk,
      parameters: cleaned,
    });
    setSaving(false);
    if (result) {
      onSaved(result);
    }
  };

  return (
    <AppModal
      icon="workflow"
      title="登记工具"
      width={860}
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
              placeholder="如 order_lookup"
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="help">
              唯一编码，需与后端 AiTool 实现一致才能启用；{AI_CODE_HINT}
            </span>
          </div>
          <div className="field">
            <label>
              名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={name}
              placeholder="如 订单查询"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>描述</label>
            <input
              className="input"
              value={description}
              placeholder="给模型看的工具说明：什么时候该调用、返回什么"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field">
            <label>风险等级</label>
            <select
              className="select"
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
            >
              <option value="low">低 · 只读</option>
              <option value="medium">中 · 有副作用</option>
              <option value="high">高 · 敏感操作</option>
            </select>
          </div>
          <div className="field span-2">
            <label>参数 Schema</label>
            <div className="ai-param-editor">
              {params.map((param, index) => (
                <div className="ai-param-row" key={`param-${index}`}>
                  <input
                    className="input"
                    value={param.name}
                    placeholder="参数名，如 query"
                    onChange={(event) =>
                      updateParam(index, { name: event.target.value })
                    }
                  />
                  <select
                    className="select"
                    value={param.type}
                    onChange={(event) =>
                      updateParam(index, { type: event.target.value })
                    }
                  >
                    {PARAM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    value={param.description || ''}
                    placeholder="参数说明"
                    onChange={(event) =>
                      updateParam(index, { description: event.target.value })
                    }
                  />
                  <label className="req">
                    <input
                      type="checkbox"
                      checked={!!param.required}
                      onChange={(event) =>
                        updateParam(index, { required: event.target.checked })
                      }
                    />
                    必填
                  </label>
                  <button
                    className="icon-btn"
                    type="button"
                    title="移除参数"
                    onClick={() =>
                      setParams((prev) =>
                        prev.length <= 1
                          ? prev
                          : prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              <button
                className="btn xs"
                type="button"
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  setParams((prev) => [...prev, { ...EMPTY_PARAM }])
                }
              >
                <Icon name="plus" size={11} />
                添加参数
              </button>
            </div>
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
            登记为草稿
          </button>
        </>
      }
    />
  );
}

interface SearchHit {
  rank: number;
  title: string;
  wikiTitle: string;
  content: string;
  score?: number;
}

interface SearchPayload {
  hits: SearchHit[];
  total?: number;
  scanned?: number;
  tookMs?: number;
}

function parseSearchContent(content: string): SearchPayload | null {
  try {
    const root = asRecord(JSON.parse(content) as unknown);
    if (!root || !Array.isArray(root.hits)) {
      return null;
    }
    const hits: SearchHit[] = [];
    root.hits.forEach((item) => {
      const hit = asRecord(item);
      if (!hit) {
        return;
      }
      const score = Number(hit.score);
      hits.push({
        rank: hits.length + 1,
        title: textOf(hit.title),
        wikiTitle: textOf(hit.wikiTitle),
        content: textOf(hit.content),
        score: Number.isFinite(score) ? score : undefined,
      });
    });
    const total = Number(root.total);
    const scanned = Number(root.scanned);
    const tookMs = Number(root.tookMs);
    return {
      hits,
      total: Number.isFinite(total) ? total : undefined,
      scanned: Number.isFinite(scanned) ? scanned : undefined,
      tookMs: Number.isFinite(tookMs) ? tookMs : undefined,
    };
  } catch {
    return null;
  }
}

function ToolInvokeDrawer({
  tool,
  onClose,
}: {
  tool: AiToolRecord;
  onClose: () => void;
}) {
  const { kbs, loading: kbLoading } = useKnowledgeBaseOptions();
  const [kbChoice, setKbChoice] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiToolInvokeResult | null>(null);
  const [formError, setFormError] = useState('');

  const needsKb = tool.code === 'knowledge_search';
  const searchPayload = result ? parseSearchContent(result.content) : null;
  useEscapeKey(onClose);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const invoke = async () => {
    if (needsKb && !kbChoice) {
      setFormError('知识库检索必须在指定库范围内执行');
      return;
    }
    const args: Record<string, unknown> = {};
    for (const param of tool.parameters) {
      const raw = (values[param.name] || '').trim();
      if (!raw) {
        if (param.required) {
          setFormError(`参数 ${param.name} 必填`);
          return;
        }
        continue;
      }
      if (param.type === 'integer' || param.type === 'number') {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
          setFormError(`参数 ${param.name} 需要是数字`);
          return;
        }
        args[param.name] = param.type === 'integer' ? Math.trunc(numeric) : numeric;
      } else if (param.type === 'boolean') {
        args[param.name] = raw === 'true';
      } else if (param.type === 'object') {
        try {
          args[param.name] = JSON.parse(raw) as unknown;
        } catch {
          setFormError(`参数 ${param.name} 不是合法 JSON`);
          return;
        }
      } else {
        args[param.name] = raw;
      }
    }
    setFormError('');
    setRunning(true);
    const response = await invokeAiTool({
      code: tool.code,
      kbId: needsKb ? kbChoice : undefined,
      arguments: args,
    });
    setRunning(false);
    if (response) {
      setResult(response);
    }
  };

  return (
    <div
      className="overlay drawer-overlay"
      onMouseDown={onClose}
    >
      <div
        className="drawer ai-tool-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name="workflow" size={18} />
            </div>
            <div className="d-copy">
              <h2>
                试调用 · {tool.name}
                <AiStatusTag status={tool.status} label={tool.statusLabel} />
              </h2>
              <div className="d-sub">
                <span className="mono">{tool.code}</span>
                <span>·</span>
                <span>{tool.provider || '未接入实现'}</span>
              </div>
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
        <div className="drawer-body">
          <div className="callout" style={{ marginTop: 0 }}>
            <Icon name="info" size={14} />
            <div className="ct">
              <p>{tool.description || '该工具没有填写描述。'}</p>
            </div>
          </div>

          {needsKb ? (
            <div className="field mt-16">
              <label>
                知识库范围<span className="req">*</span>
              </label>
              <KbSelect
                value={kbChoice}
                onChange={setKbChoice}
                options={kbs}
                loading={kbLoading}
              />
            </div>
          ) : null}

          <div className="divider" />

          {tool.parameters.length ? (
            <div className="ai-invoke-form">
              {tool.parameters.map((param) => (
                <div className="field" key={param.name}>
                  <label>
                    {param.name}
                    {param.required ? <span className="req">*</span> : null}
                    <span className="tag gray sm">{param.type}</span>
                  </label>
                  {param.type === 'boolean' ? (
                    <select
                      className="select"
                      value={values[param.name] || ''}
                      onChange={(event) =>
                        setValue(param.name, event.target.value)
                      }
                    >
                      <option value="">未设置</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : param.type === 'object' ? (
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="JSON 对象"
                      value={values[param.name] || ''}
                      onChange={(event) =>
                        setValue(param.name, event.target.value)
                      }
                    />
                  ) : (
                    <input
                      className="input"
                      type={
                        param.type === 'integer' || param.type === 'number'
                          ? 'number'
                          : 'text'
                      }
                      placeholder={param.description || ''}
                      value={values[param.name] || ''}
                      onChange={(event) =>
                        setValue(param.name, event.target.value)
                      }
                    />
                  )}
                  {param.description ? (
                    <span className="help">{param.description}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="note">该工具没有参数。</p>
          )}

          {formError ? (
            <p className="field error" style={{ marginTop: 8 }}>
              {formError}
            </p>
          ) : null}

          {result ? (
            <div className="ai-invoke-result">
              <div className="row between mb-12">
                <b>调用结果</b>
                <span className={`tag ${result.success ? 'green' : 'red'}`}>
                  {result.success ? '成功' : '失败'}
                </span>
              </div>
              {searchPayload ? (
                <>
                  <p className="note mb-12">
                    命中 {searchPayload.total ?? searchPayload.hits.length} 条
                    {searchPayload.scanned != null
                      ? ` · 扫描 ${searchPayload.scanned} 个片段`
                      : ''}
                    {searchPayload.tookMs != null
                      ? ` · ${searchPayload.tookMs} ms`
                      : ''}
                  </p>
                  {searchPayload.hits.length ? (
                    searchPayload.hits.map((hit) => (
                      <div className="ai-hit" key={`${hit.rank}-${hit.title}`}>
                        <div className="ai-hit-top">
                          <span className="idx">{hit.rank}</span>
                          <b>{hit.title || '未命名资料'}</b>
                          {hit.wikiTitle ? (
                            <span className="tag gray sm">
                              Wiki · {hit.wikiTitle}
                            </span>
                          ) : null}
                          {hit.score !== undefined ? (
                            <span className="score">
                              score {hit.score.toFixed(4)}
                            </span>
                          ) : null}
                        </div>
                        {hit.content ? <p>{hit.content}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="note">没有命中。</p>
                  )}
                </>
              ) : (
                <pre className="ai-json">{result.content}</pre>
              )}
              {result.details && Object.keys(result.details).length ? (
                <details className="mt-16">
                  <summary className="note" style={{ cursor: 'pointer' }}>
                    原始 details（{Object.keys(result.details).length} 个字段）
                  </summary>
                  <pre className="ai-json mt-16">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="drawer-foot" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn primary"
            type="button"
            disabled={running}
            onClick={() => void invoke()}
          >
            {running ? <span className="spinner" /> : <Icon name="play" size={13} />}
            执行调用
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolUsageModal({
  tool,
  onClose,
}: {
  tool: AiToolRecord;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<AiUsageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    getAiToolUsage(tool.code).then((result) => {
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
  }, [tool.code]);

  return (
    <AppModal
      icon="link"
      title={`引用关系 · ${tool.name}`}
      width={580}
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
          <>
            <div className="ai-usage-block">
              <h4>引用该工具的智能体（{usage?.agentCodes.length || 0}）</h4>
              {usage?.agentCodes.length ? (
                <div className="ai-usage-list">
                  {usage.agentCodes.map((code) => (
                    <span className="tag blue" key={code}>
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="note">没有智能体绑定该工具。</p>
              )}
            </div>
            <div className="ai-usage-block">
              <h4>关联该工具的技能（{usage?.skillCodes.length || 0}）</h4>
              {usage?.skillCodes.length ? (
                <div className="ai-usage-list">
                  {usage.skillCodes.map((code) => (
                    <span className="tag violet" key={code}>
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="note">没有技能声明该工具。</p>
              )}
            </div>
          </>
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

export default function AiToolsPage() {
  const [records, setRecords] = useState<AiToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | AiStatus>('all');
  const [tick, setTick] = useState(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [invokeTarget, setInvokeTarget] = useState<AiToolRecord | null>(null);
  const [usageTarget, setUsageTarget] = useState<AiToolRecord | null>(null);
  const runtime = useAiRuntimeStatus();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    listAiTools().then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        setRecords([]);
        return;
      }
      setRecords(result);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  const counts = useMemo(
    () => ({
      all: records.length,
      published: records.filter((item) => item.status === 'published').length,
      draft: records.filter((item) => item.status === 'draft').length,
      paused: records.filter((item) => item.status === 'paused').length,
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
      return `${item.code} ${item.name} ${item.description || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [keyword, records, status]);

  const refresh = () => setTick((value) => value + 1);

  const toggleStatus = async (tool: AiToolRecord) => {
    const next = tool.status === 'published' ? 'paused' : 'published';
    if (next === 'published' && !tool.executable) {
      toast(
        '无法启用',
        '该工具没有实现接入，启用会被后端拒绝。',
        'warn',
      );
      return;
    }
    const result = await changeAiToolStatus(tool.code, next);
    if (result) {
      toast(next === 'published' ? '已启用工具' : '已停用工具', result.name, 'success');
      refresh();
    }
  };

  const remove = async (tool: AiToolRecord) => {
    const ok = await confirmAction({
      title: `删除工具「${tool.name}」？`,
      sub: '仍被智能体或技能引用时后端会拒绝。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    const result = await removeAiTool(tool.code);
    if (result !== undefined) {
      toast('已删除工具', tool.name, 'success');
      refresh();
    }
  };

  return (
    <div className="view ai-list-page">
      {loading ? (
        <section className="panel">
          <AiLoading text="正在加载工具定义…" />
        </section>
      ) : failed ? (
        <section className="panel">
          <AiFailed
            title="工具列表加载失败"
            onRetry={refresh}
          />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="workflow" size={14} />
              工具
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
              <button
                className="btn sm primary"
                type="button"
                onClick={() => setRegisterOpen(true)}
              >
                <Icon name="plus" size={13} />
                登记工具
              </button>
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
              icon={keyword ? 'search' : 'workflow'}
              title={keyword ? '没有匹配的工具' : '还没有工具'}
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
                ) : null
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>工具</th>
                    <th>状态</th>
                    <th>实现来源</th>
                    <th>风险</th>
                    <th>参数</th>
                    <th>更新时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tool) => (
                    <tr key={tool.code}>
                      <td>
                        <div className="ai-name-cell">
                          <b>{tool.name}</b>
                          <small>{tool.code}</small>
                          {tool.description ? (
                            <span className="desc" title={tool.description}>
                              {tool.description}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <AiStatusTag
                          status={tool.status}
                          label={tool.statusLabel}
                        />
                      </td>
                      <td>
                        {tool.executable ? (
                          <span className="tag blue sm">
                            {tool.provider || 'builtin'}
                          </span>
                        ) : (
                          <span className="tag amber sm">未接入实现</span>
                        )}
                      </td>
                      <td>
                        <span className="tag gray sm">
                          {tool.riskLabel || tool.risk || '低'}
                        </span>
                      </td>
                      <td>
                        <div className="ai-binding">
                          {tool.parameters.length ? (
                            tool.parameters.map((param) => (
                              <span className="tag gray sm" key={param.name}>
                                {param.name}
                                {param.required ? '*' : ''}
                              </span>
                            ))
                          ) : (
                            <span className="note">无参数</span>
                          )}
                        </div>
                      </td>
                      <td className="mono-sm">{fmtAiTime(tool.updateTime)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn xs primary-soft"
                            type="button"
                            disabled={
                              tool.status !== 'published' || !tool.executable
                            }
                            title={
                              tool.status !== 'published' || !tool.executable
                                ? '只有已启用且有实现的工具可以试调用'
                                : '在真实上下文里执行工具'
                            }
                            onClick={() => setInvokeTarget(tool)}
                          >
                            <Icon name="play" size={11} />
                            试调用
                          </button>
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={() => setUsageTarget(tool)}
                          >
                            <Icon name="link" size={11} />
                            引用
                          </button>
                          {tool.status === 'published' ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="停用"
                              onClick={() => void toggleStatus(tool)}
                            >
                              <Icon name="pause" size={13} />
                            </button>
                          ) : tool.status === 'paused' ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="启用"
                              onClick={() => void toggleStatus(tool)}
                            >
                              <Icon name="check" size={13} />
                            </button>
                          ) : (
                            <button
                              className="icon-btn"
                              type="button"
                              title="需接入实现后才能启用"
                              onClick={() => void toggleStatus(tool)}
                            >
                              <Icon name="lock" size={13} />
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            type="button"
                            title="删除"
                            onClick={() => void remove(tool)}
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

      {registerOpen ? (
        <ToolRegisterModal
          onClose={() => setRegisterOpen(false)}
          onSaved={(saved) => {
            setRegisterOpen(false);
            toast('已登记工具', `${saved.name} · 草稿`, 'success');
            refresh();
          }}
        />
      ) : null}

      {invokeTarget ? (
        <ToolInvokeDrawer
          tool={invokeTarget}
          onClose={() => setInvokeTarget(null)}
        />
      ) : null}

      {usageTarget ? (
        <ToolUsageModal
          tool={usageTarget}
          onClose={() => setUsageTarget(null)}
        />
      ) : null}
    </div>
  );
}
