import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  CONFIG_FIELDS,
  ConfigValidationRecord,
  discardConfigDraft,
  getKnowledgeBaseConfig,
  KnowledgeBaseConfigRecord,
  ProfileVersionRecord,
  publishConfig,
  saveConfigDraft,
  submitFullRebuild,
  validateConfigDraft,
} from '@/services/configVersion';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime } from '@/utils/format';

type FormState = Record<string, string>;

const STATUS_META: Record<string, { label: string; tag: string }> = {
  DRAFT: { label: '草稿', tag: 'amber' },
  CURRENT: { label: '当前', tag: 'green' },
  SUPERSEDED: { label: '已废弃', tag: 'gray' },
};

const IMPACT_META: Record<string, { label: string; tag: string }> = {
  FULL: { label: '全量重建', tag: 'red' },
  INCREMENTAL: { label: '可增量重建', tag: 'amber' },
  NONE: { label: '不受影响', tag: 'gray' },
};

/** 只读展示时空 JSON 占位符（"{}" / "[]"）与空串一样按未配置处理，避免详情里成排裸 JSON。 */
function formatPolicyValue(value?: string): string {
  const text = (value || '').trim();
  return !text || text === '{}' || text === '[]' ? '—' : text;
}

function formFrom(version: ProfileVersionRecord | null): FormState {
  const form: FormState = {};
  for (const field of CONFIG_FIELDS) {
    const raw = version ? (version[field.key] as string | undefined) : '';
    form[field.key] = raw && raw.trim() ? raw : field.key === 'presetVersion' ? 'default' : '{}';
  }
  form.remark = version?.remark || '';
  return form;
}

export default function VersionManagementPage() {
  const params = useParams<{ kbId?: string }>();
  const navigate = useNavigate();
  const kbId = params.kbId || '';
  const [config, setConfig] = useState<KnowledgeBaseConfigRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<FormState>(formFrom(null));
  const [editing, setEditing] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ProfileVersionRecord | null>(null);
  const [validation, setValidation] = useState<ConfigValidationRecord | null>(null);
  const [busy, setBusy] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishRemark, setPublishRemark] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildConfirmed, setRebuildConfirmed] = useState(false);
  const [rebuildBatchId, setRebuildBatchId] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    if (!kbId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const result = await getKnowledgeBaseConfig(kbId);
    setLoading(false);
    if (!result) {
      setNotFound(true);
      setConfig(null);
      return;
    }
    setNotFound(false);
    setConfig(result);
    setValidation(result.validation);
    if (result.draft) {
      setForm(formFrom(result.draft));
      setEditing(true);
      setSelectedVersion(null);
    } else {
      setForm(formFrom(result.current));
      setEditing(false);
      setSelectedVersion(result.current);
    }
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = !!config?.canManage;
  const draft = config?.draft || null;
  const current = config?.current || null;
  const diff = config?.diff || [];
  const impact = config?.impact;
  const checks = draft ? validation?.items || config?.validation.items || [] : [];
  const versions = useMemo(() => config?.versions || [], [config]);
  const impactTotals = useMemo(() => {
    if (!impact) {
      return { full: 0, incremental: 0, unaffected: 0 };
    }
    return {
      full: impact.fullRebuildCount,
      incremental: impact.incrementalCount,
      unaffected: impact.unaffectedCount,
    };
  }, [impact]);

  const startDraft = (base: ProfileVersionRecord | null) => {
    setForm(formFrom(base));
    setEditing(true);
    setSelectedVersion(null);
  };

  const saveDraft = async () => {
    if (!config) {
      return;
    }
    setBusy('save');
    const result = await saveConfigDraft({
      kbId: config.kbId,
      presetVersion: form.presetVersion,
      parserPolicy: form.parserPolicy,
      chunkingPolicy: form.chunkingPolicy,
      extractionPolicy: form.extractionPolicy,
      wikiPolicy: form.wikiPolicy,
      graphPolicy: form.graphPolicy,
      reviewPolicy: form.reviewPolicy,
      freshnessPolicy: form.freshnessPolicy,
      retrievalPolicy: form.retrievalPolicy,
      remark: form.remark || undefined,
    });
    setBusy('');
    if (result === undefined) {
      return;
    }
    toast('草稿已保存', '当前版本未改变，差异与影响已重新计算', 'success');
    await load();
  };

  const runValidation = async () => {
    if (!config) {
      return;
    }
    setBusy('validate');
    const result = await validateConfigDraft(config.kbId);
    setBusy('');
    if (result === undefined) {
      return;
    }
    setValidation(result);
    toast(
      result.valid ? '校验通过' : '校验未通过',
      result.valid ? `检测到 ${result.changedCount} 项变更` : '请按校验项修正草稿',
      result.valid ? 'success' : 'warn',
    );
  };

  const confirmPublish = async () => {
    if (!config || !confirmed) {
      return;
    }
    setBusy('publish');
    const result = await publishConfig(config.kbId, publishRemark.trim() || undefined);
    setBusy('');
    if (result === undefined) {
      return;
    }
    setPublishOpen(false);
    setConfirmed(false);
    setPublishRemark('');
    toast('配置已发布', `当前版本切换为 v${result.versionNo}；全量重建是另一个动作`, 'success');
    await load();
  };

  const confirmRebuild = async () => {
    if (!config || !rebuildConfirmed) {
      return;
    }
    setBusy('rebuild');
    const result = await submitFullRebuild(config.kbId);
    setBusy('');
    if (result === undefined) {
      return;
    }
    setRebuildOpen(false);
    setRebuildConfirmed(false);
    setRebuildBatchId(result);
    toast('全量重建已提交', `编译组别 ${result.slice(0, 8)}… 可在任务管理跟踪`, 'success');
    await load();
  };

  const confirmDiscard = async () => {
    if (!config) {
      return;
    }
    setBusy('discard');
    const result = await discardConfigDraft(config.kbId);
    setBusy('');
    setDiscardOpen(false);
    if (result === undefined) {
      return;
    }
    toast('草稿已丢弃', '当前版本与历史版本没有变化', 'success');
    await load();
  };

  if (loading) {
    return (
      <div className="view">
        <div className="panel">
          <div className="panel-body">
            <span className="note">正在加载版本管理…</span>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !config) {
    return (
      <div className="view">
        <div className="panel">
          <div className="panel-body">
            <b>无法打开版本管理</b>
            <p className="note">知识库不存在，或当前身份无权访问。</p>
            <button className="btn mt-16" type="button" onClick={() => navigate('/knowledge-bases')}>
              返回知识库列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-bar">
        <span className="bar-title">
          <Icon name="git-branch" size={13} />
          版本管理
          <span className="muted">· {config.kbName}</span>
        </span>
        <span className="spacer" />
        <button
          className="btn sm ghost"
          type="button"
          onClick={() => navigate(`/knowledge-bases/${config.kbId}/settings`)}
        >
          <Icon name="arrow-left" size={12} />
          返回设置
        </button>
        <button
          className="btn sm"
          type="button"
          onClick={() => navigate(`/knowledge-bases/${config.kbId}`)}
        >
          返回知识库
        </button>
      </div>

      <div className="callout mb-16">
        <Icon name="lock" size={15} />
        <div className="ct">
          <b>这里只管配置版本，不是「库版本」</b>
          <p>
            嵌入模型 {config.embeddingModel || '—'} 与类型 {config.type} 已锁定，不在配置发布里切换；
            内容版本由物料、产物与 Wiki 各自维护。
          </p>
        </div>
      </div>

      <div className="target-grid">
        <div>
          <div className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="git-branch" size={14} />
                版本时间线
              </h3>
              <span className="hint">草稿 → 当前 → 已废弃</span>
            </div>
            <div className="panel-body">
              <div className="timeline">
                {draft || editing ? (
                  <div
                    className={`tl-item ${editing ? 'current' : ''}`}
                    onClick={() => startDraft(draft || current)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="tl-top">
                      <b>草稿{draft ? ` · v${draft.versionNo}` : '（未保存）'}</b>
                      <span className={`tag ${draft ? 'amber' : 'gray'}`}>
                        {draft ? '待发布' : '本地编辑'}
                      </span>
                    </div>
                    <p>
                      {draft
                        ? `${draft.publisherName || `actor ${draft.updateBy || '—'}`} 保存于 ${formatDateTime(draft.updateTime || draft.createTime)}`
                        : '保存后才会生成草稿版本，草稿不改变当前版本'}
                    </p>
                    <p>变更 {diff.length} 项 · {impact?.rebuildMode === 'FULL' ? '需全量重建' : impact?.rebuildMode === 'INCREMENTAL' ? '可增量重建' : '无需重建产物'}</p>
                  </div>
                ) : null}
                {versions.map((version) => {
                  const active =
                    !editing &&
                    selectedVersion?.versionNo === version.versionNo &&
                    selectedVersion?.status === version.status;
                  const meta = STATUS_META[version.status] || STATUS_META.SUPERSEDED;
                  return (
                    <div
                      key={`${version.status}-${version.versionNo}`}
                      className={`tl-item ${active ? 'current' : ''}`}
                      onClick={() => {
                        setEditing(false);
                        setSelectedVersion(version);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="tl-top">
                        <b>v{version.versionNo}</b>
                        <span className={`tag ${meta.tag}`}>{meta.label}</span>
                      </div>
                      <p>
                        {version.publisherName || (version.publishedBy ? `actor ${version.publishedBy}` : '初始配置')}
                        {' · '}
                        {formatDateTime(version.publishedAt || version.createTime)}
                      </p>
                      {version.remark ? <p>{version.remark}</p> : null}
                    </div>
                  );
                })}
              </div>
              <div className="row between mt-16">
                <span className="note">发布只切换新配置，不自动重建</span>
                <button
                  className="btn sm"
                  type="button"
                  disabled={!canManage || editing}
                  onClick={() => startDraft(draft || current)}
                >
                  <Icon name="edit" size={12} />
                  {draft ? '编辑草稿' : '新建草稿'}
                </button>
              </div>
            </div>
          </div>

          <div className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="git-compare" size={14} />
                草稿差异
              </h3>
              <span className="hint">逐项显示当前值、草稿值与影响范围</span>
            </div>
            <div className="panel-body">
              {diff.length === 0 ? (
                <div className="note">暂无差异。保存草稿后，这里会逐项列出变更与影响范围。</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="diff-table">
                    <thead>
                      <tr>
                        <th>配置项</th>
                        <th>当前值</th>
                        <th>草稿值</th>
                        <th>影响范围</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((item) => (
                        <tr key={item.field}>
                          <td>
                            <b>{item.label}</b>
                          </td>
                          <td>
                            <span className="diff-old">{item.currentValue}</span>
                          </td>
                          <td>
                            <span className="diff-new">{item.draftValue}</span>
                          </td>
                          <td>
                            <span className={`tag ${item.impactScope === 'FULL' ? 'red' : item.impactScope === 'INCREMENTAL' ? 'amber' : 'gray'}`}>
                              {item.impactLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="edit" size={14} />
                {editing ? '编辑配置草稿' : `版本详情 · v${selectedVersion?.versionNo ?? '—'}`}
              </h3>
              <span className="hint">
                {editing ? '保存草稿不改变线上行为' : '历史版本只读，回滚 = 用旧快照发布新版本'}
              </span>
            </div>
            <div className="panel-body">
              {!canManage ? (
                <div className="callout mb-16">
                  <Icon name="lock" size={15} />
                  <div className="ct">
                    <b>只读视图</b>
                    <p>只有知识库管理员可以保存草稿、发布配置与申请全量重建。</p>
                  </div>
                </div>
              ) : null}

              {editing ? (
                <div className="form-grid">
                  {CONFIG_FIELDS.map((field) => (
                    <div
                      className={`field ${field.multiline ? 'span-2' : ''}`}
                      key={field.key}
                    >
                      <label>
                        {field.label}
                        <span className={`tag ${field.scope === 'FULL' ? 'red' : field.scope === 'INCREMENTAL' ? 'amber' : 'gray'} sm`} style={{ marginLeft: 6 }}>
                          {IMPACT_META[field.scope].label}
                        </span>
                      </label>
                      {field.multiline ? (
                        <textarea
                          className="textarea mono-sm"
                          rows={3}
                          value={form[field.key] || ''}
                          disabled={!canManage}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        />
                      ) : (
                        <input
                          className="input mono"
                          value={form[field.key] || ''}
                          disabled={!canManage}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        />
                      )}
                      <span className="note">{field.hint}</span>
                    </div>
                  ))}
                  <div className="field span-2">
                    <label>发布说明</label>
                    <input
                      className="input"
                      value={form.remark || ''}
                      maxLength={500}
                      disabled={!canManage}
                      placeholder="可选；发布后显示在版本时间线上"
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, remark: event.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <dl className="kv">
                  <dt>版本</dt>
                  <dd className="mono">v{selectedVersion?.versionNo ?? '—'}</dd>
                  <dt>状态</dt>
                  <dd>
                    <span className={`tag ${STATUS_META[selectedVersion?.status || 'SUPERSEDED'].tag}`}>
                      {STATUS_META[selectedVersion?.status || 'SUPERSEDED'].label}
                    </span>
                  </dd>
                  <dt>发布人</dt>
                  <dd>
                    {selectedVersion?.publisherName ||
                      (selectedVersion?.publishedBy ? `actor ${selectedVersion.publishedBy}` : '—')}
                  </dd>
                  <dt>发布时间</dt>
                  <dd>{formatDateTime(selectedVersion?.publishedAt || selectedVersion?.createTime)}</dd>
                  {CONFIG_FIELDS.map((field) => (
                    <div key={field.key} style={{ display: 'contents' }}>
                      <dt>{field.label}</dt>
                      <dd
                        className="mono-sm"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                      >
                        {formatPolicyValue(selectedVersion?.[field.key] as string | undefined)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {editing ? (
                <div className="row between mt-16">
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busy !== '' || !canManage}
                    onClick={() => setDiscardOpen(true)}
                  >
                    <Icon name="trash" size={13} />
                    丢弃草稿
                  </button>
                  <div className="row gap-6">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy !== '' || !canManage || !draft}
                      title={draft ? '按已保存的草稿校验' : '先保存草稿再校验'}
                      onClick={() => void runValidation()}
                    >
                      <Icon name="shield-check" size={13} />
                      {busy === 'validate' ? '校验中…' : '校验草稿'}
                    </button>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={busy !== '' || !canManage}
                      onClick={() => void saveDraft()}
                    >
                      <Icon name="check" size={13} />
                      {busy === 'save' ? '保存中…' : '保存草稿'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row between mt-16">
                  <span className="note">历史版本不能直接“切回”，需要以其为基线重新编辑并发布</span>
                  <button
                    className="btn"
                    type="button"
                    disabled={!canManage}
                    onClick={() => startDraft(selectedVersion || current)}
                  >
                    <Icon name="edit" size={13} />
                    以该版本为基线新建草稿
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="bar-chart" size={14} />
                影响分析
              </h3>
              <span className="hint">按物料计数，不把产物条数当物料数</span>
            </div>
            <div className="panel-body">
              <div className="grid impact-stats mb-16">
                <div className="stat">
                  <div className="label">全量重建</div>
                  <div className="value tnum">{impactTotals.full}</div>
                  <div className="foot">预设、解析、切块变化</div>
                </div>
                <div className="stat amber">
                  <div className="label">可增量重建</div>
                  <div className="value tnum">{impactTotals.incremental}</div>
                  <div className="foot">抽取、编页、图谱变化</div>
                </div>
                <div className="stat green">
                  <div className="label">不受影响</div>
                  <div className="value tnum">{impactTotals.unaffected}</div>
                  <div className="foot">流程与检索参数</div>
                </div>
              </div>
              <dl className="kv">
                <dt>重建口径</dt>
                <dd>
                  <span
                    className={`tag ${
                      impact?.rebuildMode === 'FULL'
                        ? 'red'
                        : impact?.rebuildMode === 'INCREMENTAL'
                          ? 'amber'
                          : 'gray'
                    }`}
                  >
                    {impact ? IMPACT_META[impact.rebuildMode].label : '—'}
                  </span>
                </dd>
                <dt>物料总数</dt>
                <dd className="mono">{impact?.totalMaterials ?? 0}</dd>
                <dt>已解析</dt>
                <dd className="mono">{impact?.parsedMaterials ?? 0}</dd>
                <dt>尚未解析</dt>
                <dd className="mono">{impact?.notParsedCount ?? 0}</dd>
              </dl>
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>影响说明</b>
                  {(impact?.notes || []).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="shield-check" size={14} />
                草稿校验
              </h3>
              <span className={`tag ${!draft ? 'gray' : validation?.valid ? 'green' : 'amber'}`}>
                {!draft ? '无草稿' : validation?.valid ? '可发布' : '待处理'}
              </span>
            </div>
            <div className="panel-body">
              <div className="check-list">
                {checks.map((item) => (
                  <div className="check-item" key={item.key}>
                    <span className="ic">
                      <Icon name={item.ok ? 'check-circle' : 'alert-circle'} size={14} />
                    </span>
                    <div>
                      <b>{item.label}</b>
                      <small>{item.message}</small>
                    </div>
                  </div>
                ))}
                {checks.length === 0 ? (
                  <span className="note">当前没有草稿；新建草稿后可校验。</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="play" size={14} />
                发布与重建
              </h3>
              <span className="hint">两个独立动作，分别审计</span>
            </div>
            <div className="panel-body">
              <div className="binding-row">
                <span className="ic">
                  <Icon name="send" size={15} />
                </span>
                <div className="copy">
                  <b>发布配置</b>
                  <small>把草稿切换为新的当前版本；不重建产物，不回溯历史任务</small>
                </div>
                <button
                  className="btn primary sm"
                  type="button"
                  disabled={!canManage || !draft}
                  onClick={() => {
                    setConfirmed(false);
                    setPublishRemark(form.remark || '');
                    setPublishOpen(true);
                  }}
                >
                  <Icon name="send" size={12} />
                  发布配置
                </button>
              </div>
              <div className="binding-row mt-12">
                <span className="ic">
                  <Icon name="refresh" size={15} />
                </span>
                <div className="copy">
                  <b>申请全量重建</b>
                  <small>按当前库内全部物料提交编译组别，进度与重试在任务管理跟踪</small>
                </div>
                <button
                  className="btn sm"
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    setRebuildConfirmed(false);
                    setRebuildOpen(true);
                  }}
                >
                  <Icon name="refresh" size={12} />
                  申请全量重建
                </button>
              </div>
              {rebuildBatchId ? (
                <div className="callout mt-16">
                  <Icon name="check-circle" size={15} />
                  <div className="ct">
                    <b>已提交全量重建</b>
                    <p className="mono-sm">{rebuildBatchId}</p>
                    <p>
                      前往
                      <button
                        className="link"
                        type="button"
                        style={{ marginLeft: 4 }}
                        onClick={() =>
                          navigate(`/knowledge-bases/${config.kbId}/governance`)
                        }
                      >
                        任务管理
                      </button>
                      查看编译组别与成员结果。
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="callout mt-16">
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>重建前先算增量，再提交任务</b>
                  <p>
                    破坏性动作由后端做有界性检查：单次最多 200 个物料；超过上限会拒绝请求。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {publishOpen ? (
        <AppModal
          icon="send"
          title={`发布配置 · ${config.kbName}`}
          sub="发布配置"
          width={680}
          onClose={() => setPublishOpen(false)}
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setPublishOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!confirmed || busy === 'publish' || !validation?.valid}
                onClick={() => void confirmPublish()}
              >
                <Icon name="send" size={12} />
                {busy === 'publish' ? '发布中…' : '确认发布'}
              </button>
            </>
          }
          body={
            <div>
              <div className="callout">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>发布只切换配置，不触发重建</b>
                  <p>
                    把草稿发布为 v{draft?.versionNo ?? '—'}；已创建任务继续使用创建时的完整快照。
                  </p>
                </div>
              </div>
              <div className="mt-16">
                <b style={{ fontSize: 11.5 }}>逐项确认变更与影响</b>
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table className="diff-table">
                    <thead>
                      <tr>
                        <th>配置项</th>
                        <th>当前值</th>
                        <th>草稿值</th>
                        <th>影响范围</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((item) => (
                        <tr key={item.field}>
                          <td>{item.label}</td>
                          <td>
                            <span className="diff-old">{item.currentValue}</span>
                          </td>
                          <td>
                            <span className="diff-new">{item.draftValue}</span>
                          </td>
                          <td>
                            <span className={`tag ${item.impactScope === 'FULL' ? 'red' : item.impactScope === 'INCREMENTAL' ? 'amber' : 'gray'}`}>
                              {item.impactLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-3 mt-16">
                <div className="stat">
                  <div className="label">全量重建</div>
                  <div className="value tnum">{impactTotals.full}</div>
                </div>
                <div className="stat amber">
                  <div className="label">可增量重建</div>
                  <div className="value tnum">{impactTotals.incremental}</div>
                </div>
                <div className="stat green">
                  <div className="label">不受影响</div>
                  <div className="value tnum">{impactTotals.unaffected}</div>
                </div>
              </div>
              {!validation?.valid ? (
                <div className="callout danger mt-16">
                  <Icon name="alert-triangle" size={15} />
                  <div className="ct">
                    <b>草稿未通过校验</b>
                    <p>请先处理校验项，再发布配置。</p>
                  </div>
                </div>
              ) : null}
              <div className="field mt-16">
                <label>发布说明</label>
                <input
                  className="input"
                  value={publishRemark}
                  maxLength={500}
                  placeholder="可选"
                  onChange={(event) => setPublishRemark(event.target.value)}
                />
              </div>
              <label className="check-item mt-16" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我已逐项确认上述差异与影响范围，理解发布不会自动重建产物
                </span>
              </label>
            </div>
          }
        />
      ) : null}

      {rebuildOpen ? (
        <AppModal
          icon="refresh"
          title={`申请全量重建 · ${config.kbName}`}
          sub="全量重建"
          width={600}
          onClose={() => setRebuildOpen(false)}
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setRebuildOpen(false)}>
                取消
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={!rebuildConfirmed || busy === 'rebuild'}
                onClick={() => void confirmRebuild()}
              >
                <Icon name="refresh" size={12} />
                {busy === 'rebuild' ? '提交中…' : '确认提交'}
              </button>
            </>
          }
          body={
            <div>
              <div className="callout danger">
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>重建会重新编译库内全部物料</b>
                  <p>
                    当前 {impact?.totalMaterials ?? 0} 个物料将扇出为编译组别；已创建任务与历史版本不受影响。
                  </p>
                </div>
              </div>
              <dl className="kv mt-16">
                <dt>当前配置版本</dt>
                <dd className="mono">v{current?.versionNo ?? '—'}</dd>
                <dt>重建口径</dt>
                <dd>全量重建（与草稿影响分析无关）</dd>
                <dt>单次上限</dt>
                <dd className="mono">200 个物料</dd>
                <dt>跟踪位置</dt>
                <dd>任务管理 · 编译组别</dd>
              </dl>
              <label className="check-item mt-16" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rebuildConfirmed}
                  onChange={(event) => setRebuildConfirmed(event.target.checked)}
                />
                <span>我确认按当前配置全量重建，并到任务管理跟踪任务</span>
              </label>
            </div>
          }
        />
      ) : null}

      {discardOpen ? (
        <AppModal
          icon="trash"
          title="丢弃配置草稿"
          sub="草稿"
          width={520}
          onClose={() => setDiscardOpen(false)}
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setDiscardOpen(false)}>
                取消
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy === 'discard'}
                onClick={() => void confirmDiscard()}
              >
                <Icon name="trash" size={12} />
                {busy === 'discard' ? '丢弃中…' : '确认丢弃'}
              </button>
            </>
          }
          body={
            <div className="callout danger">
              <Icon name="alert-triangle" size={15} />
              <div className="ct">
                <b>只丢弃未发布的草稿</b>
                <p>当前版本与历史版本保持不变；已发布版本不会因此回退。</p>
              </div>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
