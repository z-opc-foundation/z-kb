import Icon from '@/components/icon';
import type { IconName } from '@/components/icon';
import { confirmAction } from '@/components/confirm';
import {
  KnowledgeBaseSourceBook,
  KnowledgeBaseSourceCatalog,
  KnowledgeBaseSourceDoc,
  KnowledgeBaseSourcePayload,
  KnowledgeBaseSourceRecord,
  KnowledgeBaseSourceTestResult,
  listKnowledgeBaseSources,
  loadYuqueCatalog,
  loadYuqueCatalogDocs,
  saveKnowledgeBaseSources,
  SourceProvider,
  syncKnowledgeBaseSource,
  testKnowledgeBaseSource,
} from '@/services/knowledgeBaseSource';
import { toast } from '@/utils/toast';
import { readSelection, type SelectedBook } from './source-selection';
import { useCallback, useEffect, useState } from 'react';

const CATEGORY_ORDER = ['DOC_PLATFORM', 'CODE_REPO', 'FILE_SHARE', 'DATABASE'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  DOC_PLATFORM: '文档平台',
  CODE_REPO: '代码仓库',
  FILE_SHARE: '文件共享',
  DATABASE: '数据库',
};

interface ScopeField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

interface ProviderMeta {
  label: string;
  category: string;
  icon: IconName;
  scopeFields: ScopeField[];
  credential: string;
  secretHint: string;
  defaultScope?: Record<string, string>;
}

const YUQUE_DEFAULT_BASE_URL = 'https://come-future.yuque.com/api/v2';

const PROVIDER_META: Record<SourceProvider, ProviderMeta> = {
  YUQUE: {
    label: '语雀',
    category: 'DOC_PLATFORM',
    icon: 'book',
    scopeFields: [
      {
        key: 'namespace',
        label: '团队空间',
        placeholder: '如 xr4hwk',
      },
      { key: 'apiBaseUrl', label: '域名', placeholder: YUQUE_DEFAULT_BASE_URL },
    ],
    credential: 'TOKEN',
    secretHint: '语雀个人访问令牌',
    defaultScope: { apiBaseUrl: YUQUE_DEFAULT_BASE_URL },
  },
  GIT: {
    label: 'Git 仓库',
    category: 'CODE_REPO',
    icon: 'git-branch',
    scopeFields: [
      {
        key: 'repo',
        label: '仓库地址',
        placeholder: 'https://git.example.com/group/repo.git',
        required: true,
      },
      { key: 'branch', label: '分支', placeholder: 'main' },
      { key: 'path', label: '文档目录', placeholder: '只同步该目录，如 docs（留空为整库）' },
    ],
    credential: 'TOKEN',
    secretHint: '仓库访问令牌（GitLab 个人令牌）',
  },
  OSS: {
    label: '对象存储',
    category: 'FILE_SHARE',
    icon: 'folder-open',
    scopeFields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://oss.example.com' },
      { key: 'bucket', label: 'Bucket', placeholder: 'bucket 名称' },
    ],
    credential: 'BASIC',
    secretHint: '对象存储访问密钥',
  },
  SMB: {
    label: '共享目录',
    category: 'FILE_SHARE',
    icon: 'folder',
    scopeFields: [{ key: 'path', label: '目录路径', placeholder: '\\\\host\\share\\docs' }],
    credential: 'BASIC',
    secretHint: '共享目录访问密码',
  },
  JDBC: {
    label: '数据库',
    category: 'DATABASE',
    icon: 'database',
    scopeFields: [
      {
        key: 'url',
        label: '连接串',
        placeholder: 'jdbc:mysql://host:3306/db',
        required: true,
      },
    ],
    credential: 'BASIC',
    secretHint: '数据库访问密码',
  },
};

const PROVIDER_ORDER: SourceProvider[] = ['YUQUE', 'GIT', 'OSS', 'SMB', 'JDBC'];

const PROBE_SUPPORTED: SourceProvider[] = ['YUQUE', 'GIT'];

const SYNC_SUPPORTED: SourceProvider[] = ['YUQUE', 'GIT'];

const CREDENTIAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'NONE', label: '无凭据' },
  { value: 'TOKEN', label: '访问令牌' },
  { value: 'BASIC', label: '账号密码' },
];

interface DocCacheEntry {
  loading: boolean;
  docs: KnowledgeBaseSourceDoc[];
  message?: string;
}

interface SourceDraft {
  localKey: string;
  sourceId?: string;
  provider: SourceProvider;
  name: string;
  enabled: boolean;
  scopeValues: Record<string, string>;
  selection: SelectedBook[];
  credentialType: string;
  credentialUsername: string;
  secret: string;
  secretRef: string;
  hasSecret: boolean;
}

interface EditorState {
  index: number | null;
  draft: SourceDraft;
}

interface SourceConfigPanelProps {
  kbId: string;
  canManage: boolean;
}

let draftSeq = 0;

function nextLocalKey(): string {
  draftSeq += 1;
  return `draft-${Date.now()}-${draftSeq}`;
}

function normalizeProvider(value: string): SourceProvider {
  return Object.prototype.hasOwnProperty.call(PROVIDER_META, value)
    ? (value as SourceProvider)
    : 'YUQUE';
}

function toDraft(source: KnowledgeBaseSourceRecord): SourceDraft {
  const provider = normalizeProvider(source.provider);
  const scopeValues: Record<string, string> = {};
  PROVIDER_META[provider].scopeFields.forEach((field) => {
    const value = source.scope?.[field.key];
    scopeValues[field.key] = value === undefined || value === null ? '' : String(value);
  });
  return {
    localKey: source.sourceId || nextLocalKey(),
    sourceId: source.sourceId,
    provider,
    name: source.name,
    enabled: source.enabled !== false,
    scopeValues,
    selection: readSelection(source.scope),
    credentialType: source.credentialType || PROVIDER_META[provider].credential,
    credentialUsername: source.credentialUsername || '',
    secret: '',
    secretRef: source.secretRef || '',
    hasSecret: !!source.hasSecret,
  };
}

function blankDraft(provider: SourceProvider): SourceDraft {
  return {
    localKey: nextLocalKey(),
    provider,
    name: '',
    enabled: true,
    scopeValues: { ...(PROVIDER_META[provider].defaultScope ?? {}) },
    selection: [],
    credentialType: PROVIDER_META[provider].credential,
    credentialUsername: '',
    secret: '',
    secretRef: '',
    hasSecret: false,
  };
}

function toPayload(draft: SourceDraft): KnowledgeBaseSourcePayload {
  const meta = PROVIDER_META[draft.provider];
  const scope: Record<string, unknown> = {};
  meta.scopeFields.forEach((field) => {
    const value = draft.scopeValues[field.key]?.trim();
    if (value) {
      scope[field.key] = value;
    }
  });
  if (draft.provider === 'YUQUE' && draft.selection.length > 0) {
    scope.selection = draft.selection.map((book) => ({
      book: book.book,
      name: book.name,
      docs: book.docs.map((doc) => ({ slug: doc.slug, title: doc.title })),
    }));
  }
  return {
    sourceId: draft.sourceId,
    category: meta.category,
    provider: draft.provider,
    name: draft.name.trim(),
    enabled: draft.enabled,
    scope,
    credentialType: draft.credentialType,
    credentialUsername: draft.credentialUsername.trim() || undefined,
    secret: draft.secret.trim() || undefined,
    secretRef: draft.secretRef.trim() || undefined,
  };
}

/** 已保存的值不在本次加载结果里时仍保留为一个选项，避免打开抽屉就丢范围。 */
function keepCurrentOption(current: string | undefined, values: string[]) {
  if (!current || values.includes(current)) {
    return null;
  }
  return <option value={current}>{current}（不在列表中）</option>;
}

function scopeSummary(draft: SourceDraft): string {
  const meta = PROVIDER_META[draft.provider];
  const parts = meta.scopeFields
    .map((field) => {
      const value = draft.scopeValues[field.key]?.trim();
      return value ? `${field.label} ${value}` : '';
    })
    .filter((part) => part !== '');
  if (draft.provider === 'YUQUE') {
    parts.push(
      draft.selection.length ? `${draft.selection.length} 个知识库` : '未选知识库',
    );
  }
  return parts.length ? parts.join(' · ') : '—';
}

export default function SourceConfigPanel({ kbId, canManage }: SourceConfigPanelProps) {
  const [items, setItems] = useState<SourceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Record<string, KnowledgeBaseSourceTestResult>>({});
  const [testingKey, setTestingKey] = useState('');
  const [syncingKey, setSyncingKey] = useState('');
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [editorTesting, setEditorTesting] = useState(false);
  const [editorResult, setEditorResult] = useState<KnowledgeBaseSourceTestResult | null>(null);
  const [catalog, setCatalog] = useState<KnowledgeBaseSourceCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [docCache, setDocCache] = useState<Record<string, DocCacheEntry>>({});
  const [expandedBook, setExpandedBook] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listKnowledgeBaseSources(kbId);
    setLoading(false);
    if (!result) {
      setError('接入源加载失败');
      return;
    }
    setItems(result.map(toDraft));
    setResults({});
    setDirty(false);
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = async () => {
    if (dirty) {
      const ok = await confirmAction({
        title: '重新加载接入源？',
        sub: '有未保存的变更，重新加载会丢弃这些修改。',
        confirmText: '重新加载',
        danger: false,
      });
      if (!ok) {
        return;
      }
    }
    void load();
  };

  const save = async () => {
    if (!canManage) {
      return;
    }
    const unnamed = items.find((item) => !item.name.trim());
    if (unnamed) {
      toast('不能保存', '接入源名称不能为空', 'warn');
      return;
    }
    const missing = items.find((item) =>
      PROVIDER_META[item.provider].scopeFields.some(
        (field) => field.required && !item.scopeValues[field.key]?.trim(),
      ),
    );
    if (missing) {
      const field = PROVIDER_META[missing.provider].scopeFields.find(
        (candidate) => candidate.required && !missing.scopeValues[candidate.key]?.trim(),
      );
      toast('不能保存', `${PROVIDER_META[missing.provider].label}缺少${field?.label || '必填项'}`, 'warn');
      return;
    }
    const noBooks = items.find((item) => item.provider === 'YUQUE' && item.selection.length === 0);
    if (noBooks) {
      toast('不能保存', `语雀接入源「${noBooks.name || '未命名接入源'}」还没有勾选知识库`, 'warn');
      return;
    }
    setSaving(true);
    const result = await saveKnowledgeBaseSources(
      kbId,
      items.map(toPayload),
    );
    setSaving(false);
    if (!result) {
      return;
    }
    setItems(result.map(toDraft));
    setResults({});
    setDirty(false);
    toast('已保存', `当前共 ${result.length} 条接入源`, 'success');
  };

  const testItem = async (draft: SourceDraft) => {
    if (!PROBE_SUPPORTED.includes(draft.provider)) {
      toast('暂不支持', '该供应商暂不支持连通性测试', 'warn');
      return;
    }
    setTestingKey(draft.localKey);
    const result = await testKnowledgeBaseSource(kbId, toPayload(draft));
    setTestingKey('');
    if (!result) {
      return;
    }
    setResults((current) => ({ ...current, [draft.localKey]: result }));
  };

  const syncItem = async (draft: SourceDraft) => {
    if (!SYNC_SUPPORTED.includes(draft.provider)) {
      toast('暂不支持', '该供应商暂不支持同步', 'warn');
      return;
    }
    if (!draft.sourceId) {
      toast('不能同步', '请先保存这条接入源', 'warn');
      return;
    }
    if (dirty) {
      toast('不能同步', '有未保存的变更，请先保存再同步', 'warn');
      return;
    }
    const ok = await confirmAction({
      title: `从「${draft.name}」同步一次？`,
      sub: '会拉取一次目录并把新条目登记为资料，已有条目不会重复登记。',
      confirmText: '开始同步',
      danger: false,
    });
    if (!ok) {
      return;
    }
    setSyncingKey(draft.localKey);
    const result = await syncKnowledgeBaseSource(kbId, draft.sourceId);
    setSyncingKey('');
    if (!result) {
      return;
    }
    toast(
      result.reusing ? '已在同步中' : '已发起同步',
      result.reusing
        ? '该接入源已有运行中的同步任务，本次未重复发起'
        : '采集同步任务已排入队列，可在任务管理查看进度与结果',
      'success',
    );
  };

  const removeItem = async (index: number) => {
    if (!canManage) {
      return;
    }
    const target = items[index];
    const ok = await confirmAction({
      title: `删除接入源「${target.name || '未命名接入源'}」？`,
      sub: '点保存变更后才真正生效。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    setItems((current) => current.filter((_, position) => position !== index));
    setDirty(true);
  };

  const toggleEnabled = (index: number) => {
    if (!canManage) {
      return;
    }
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    setDirty(true);
  };

  const openCreate = () => {
    setEditorResult(null);
    setCatalog(null);
    setDocCache({});
    setExpandedBook('');
    setEditing({ index: null, draft: blankDraft('YUQUE') });
  };

  const openEdit = (index: number) => {
    const source = items[index];
    setEditorResult(null);
    setCatalog(null);
    setDocCache({});
    setExpandedBook('');
    setEditing({
      index,
      draft: {
        ...source,
        scopeValues: { ...source.scopeValues },
        selection: source.selection.map((book) => ({
          ...book,
          docs: book.docs.map((doc) => ({ ...doc })),
        })),
        secret: '',
      },
    });
  };

  const patchEditor = (patch: Partial<SourceDraft>) => {
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  };

  const changeEditorProvider = (provider: SourceProvider) => {
    const meta = PROVIDER_META[provider];
    setEditorResult(null);
    setCatalog(null);
    setDocCache({});
    setExpandedBook('');
    setEditing((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              provider,
              scopeValues: { ...(meta.defaultScope ?? {}) },
              selection: [],
              credentialType: meta.credential,
              credentialUsername: '',
              hasSecret: false,
            },
          }
        : current,
    );
  };

  const patchScope = (key: string, value: string) => {
    setEditing((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              scopeValues: { ...current.draft.scopeValues, [key]: value },
            },
          }
        : current,
    );
  };

  const patchSelection = (updater: (current: SelectedBook[]) => SelectedBook[]) => {
    setEditing((current) =>
      current
        ? { ...current, draft: { ...current.draft, selection: updater(current.draft.selection) } }
        : current,
    );
  };

  /** 勾选/取消一个知识库；勾选默认整库同步。 */
  const toggleBook = (book: KnowledgeBaseSourceBook) => {
    patchSelection((current) =>
      current.some((item) => item.book === book.namespace)
        ? current.filter((item) => item.book !== book.namespace)
        : [...current, { book: book.namespace, name: book.name || book.slug, docs: [] }],
    );
  };

  /** 勾选/取消一篇文章；清空即回到整库。 */
  const toggleDoc = (bookScope: string, doc: KnowledgeBaseSourceDoc) => {
    patchSelection((current) =>
      current.map((item) => {
        if (item.book !== bookScope) {
          return item;
        }
        const picked = item.docs.some((entry) => entry.slug === doc.slug);
        return {
          ...item,
          docs: picked
            ? item.docs.filter((entry) => entry.slug !== doc.slug)
            : [...item.docs, { slug: doc.slug, title: doc.title || doc.slug }],
        };
      }),
    );
  };

  /** 展开某个已选知识库时按当前凭据读取文章清单，已读过就复用。 */
  const loadDocs = async (bookScope: string) => {
    if (!editing) {
      return;
    }
    if (expandedBook === bookScope) {
      setExpandedBook('');
      return;
    }
    setExpandedBook(bookScope);
    if (docCache[bookScope] && !docCache[bookScope].loading) {
      return;
    }
    setDocCache((current) => ({
      ...current,
      [bookScope]: { loading: true, docs: [] },
    }));
    const result = await loadYuqueCatalogDocs(kbId, toPayload(editing.draft), bookScope);
    setDocCache((current) => ({
      ...current,
      [bookScope]: result
        ? { loading: false, docs: result.docs, message: result.message }
        : { loading: false, docs: [], message: '文章加载失败' },
    }));
    if (result?.message) {
      toast('文章未加载', result.message, 'warn');
    }
  };

  /** 用当前填写的凭据读团队与知识库；teamSlug 有值时同时切换到该团队再加载。 */
  const loadCatalog = async (teamSlug?: string) => {
    if (!editing) {
      return;
    }
    const draft: SourceDraft = {
      ...editing.draft,
      scopeValues: {
        ...editing.draft.scopeValues,
        ...(teamSlug === undefined ? {} : { namespace: teamSlug }),
      },
    };
    if (teamSlug !== undefined) {
      setEditing({ ...editing, draft });
      setDocCache({});
      setExpandedBook('');
    }
    setCatalogLoading(true);
    const result = await loadYuqueCatalog(kbId, toPayload(draft));
    setCatalogLoading(false);
    if (!result) {
      return;
    }
    setCatalog(result);
    if (result.message) {
      toast('加载未完成', result.message, 'warn');
    } else if (!result.spaces.length) {
      toast('没有可选团队', '当前令牌没有加入任何语雀团队', 'warn');
    }
  };

  const testEditor = async () => {
    if (!editing) {
      return;
    }
    if (!PROBE_SUPPORTED.includes(editing.draft.provider)) {
      toast('暂不支持', '该供应商暂不支持连通性测试', 'warn');
      return;
    }
    setEditorTesting(true);
    const result = await testKnowledgeBaseSource(kbId, toPayload(editing.draft));
    setEditorTesting(false);
    if (result) {
      setEditorResult(result);
    }
  };

  const applyEditor = () => {
    if (!editing) {
      return;
    }
    const draft = editing.draft;
    if (!draft.name.trim()) {
      toast('不能添加', '接入源名称不能为空', 'warn');
      return;
    }
    const meta = PROVIDER_META[draft.provider];
    const missing = meta.scopeFields.find(
      (field) => field.required && !draft.scopeValues[field.key]?.trim(),
    );
    if (missing) {
      toast('不能添加', `${meta.label}缺少${missing.label}`, 'warn');
      return;
    }
    if (draft.provider === 'YUQUE' && draft.selection.length === 0) {
      toast('不能添加', '语雀接入源至少要勾选一个知识库', 'warn');
      return;
    }
    const normalized: SourceDraft = {
      ...draft,
      name: draft.name.trim(),
      scopeValues: { ...draft.scopeValues },
    };
    setItems((current) =>
      editing.index === null
        ? [...current, normalized]
        : current.map((item, position) => (position === editing.index ? normalized : item)),
    );
    setDirty(true);
    setEditing(null);
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-body">
          <span className="note">正在加载接入源…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body row between">
          <span className="note">{error}</span>
          <button className="btn sm" type="button" onClick={reload}>
            <Icon name="refresh" size={12} />
            重试
          </button>
        </div>
      </div>
    );
  }

  const groups = CATEGORY_ORDER.map((code) => ({
    code,
    label: CATEGORY_LABEL[code] || code,
    rows: items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => PROVIDER_META[item.provider].category === code),
  })).filter((group) => group.rows.length > 0);

  const editorMeta = editing ? PROVIDER_META[editing.draft.provider] : null;

  return (
    <div className="source-config">
      <div className="row between mb-12">
        <span className="note">
          {dirty ? '有未保存的变更 · 保存后生效' : canManage ? '' : '只读 · 修改需要库管理权限'}
        </span>
        <div className="row gap-6">
          <button className="btn sm" type="button" onClick={reload}>
            <Icon name="refresh" size={12} />
            重新加载
          </button>
          {canManage ? (
            <>
              <button className="btn sm" type="button" onClick={openCreate}>
                <Icon name="plus" size={12} />
                新增接入源
              </button>
              <button
                className="btn sm primary"
                type="button"
                disabled={saving || !dirty}
                onClick={() => void save()}
              >
                <Icon name="check" size={12} />
                {saving ? '保存中…' : '保存变更'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="note" style={{ padding: '26px 0', textAlign: 'center' }}>
              还没有接入源
            </div>
          </div>
        </div>
      ) : null}

      {groups.map((group) => (
        <div className="panel mb-16" key={group.code}>
          <div className="panel-head">
            <h3>
              <Icon name="plug" size={14} />
              {group.label}
            </h3>
            <span className="hint">{group.rows.length} 条</span>
          </div>
          <div className="table-wrap">
            <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>供应商</th>
                  <th>范围</th>
                  <th>凭据</th>
                  <th>状态</th>
                  <th>连通性</th>
                  <th style={{ width: 190 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(({ item, index }) => {
                  const meta = PROVIDER_META[item.provider];
                  const result = results[item.localKey];
                  const supported = PROBE_SUPPORTED.includes(item.provider);
                  return (
                    <tr key={item.localKey}>
                      <td>
                        <div className="name-cell">
                          <Icon name={meta.icon} size={13} />
                          <b>{item.name || '未命名接入源'}</b>
                        </div>
                      </td>
                      <td>
                        <span className="tag gray sm">{meta.label}</span>
                      </td>
                      <td className="mono-sm">{scopeSummary(item)}</td>
                      <td className="note">
                        {item.hasSecret
                          ? `${item.credentialType || '—'} · 已配置`
                          : `${item.credentialType || '—'} · 未配置`}
                      </td>
                      <td>
                        <button
                          className={`tag ${item.enabled ? 'green' : 'gray'}`}
                          type="button"
                          disabled={!canManage}
                          title={canManage ? '点击切换启停' : '需要库管理权限'}
                          style={{ cursor: canManage ? 'pointer' : 'not-allowed' }}
                          onClick={() => toggleEnabled(index)}
                        >
                          {item.enabled ? '已启用' : '已停用'}
                        </button>
                      </td>
                      <td>
                        {result ? (
                          <span
                            className={`tag ${result.reachable ? 'green' : 'red'}`}
                            title={result.message}
                          >
                            {result.reachable ? `通 · ${result.latencyMs}ms` : '不通'}
                          </span>
                        ) : (
                          <span className="note">—</span>
                        )}
                      </td>
                      <td>
                        <div className="row gap-6">
                          <button
                            className="btn sm"
                            type="button"
                            disabled={!supported || testingKey === item.localKey}
                            title={supported ? '发一次只读请求验证连通' : '该供应商暂不支持连通性测试'}
                            onClick={() => void testItem(item)}
                          >
                            <Icon name="link" size={12} />
                            {testingKey === item.localKey ? '测试中…' : '测试'}
                          </button>
                          <button
                            className="btn sm"
                            type="button"
                            disabled={
                              !canManage
                              || !SYNC_SUPPORTED.includes(item.provider)
                              || !item.sourceId
                              || syncingKey === item.localKey
                            }
                            title={
                              !SYNC_SUPPORTED.includes(item.provider)
                                ? '该供应商暂不支持同步'
                                : !item.sourceId
                                  ? '请先保存这条接入源'
                                  : '拉取一次目录并把文档登记为资料'
                            }
                            onClick={() => void syncItem(item)}
                          >
                            <Icon name="refresh" size={12} />
                            {syncingKey === item.localKey ? '已发起…' : '同步'}
                          </button>
                          {canManage ? (
                            <>
                              <button className="btn sm" type="button" onClick={() => openEdit(index)}>
                                <Icon name="edit" size={12} />
                                编辑
                              </button>
                              <button
                                className="btn sm danger"
                                type="button"
                                onClick={() => removeItem(index)}
                              >
                                <Icon name="trash" size={12} />
                                删除
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && editorMeta ? (
        <div className="overlay drawer-overlay" onMouseDown={() => setEditing(null)}>
          <aside
            className="drawer task-config-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <div className="d-top">
                <div className="d-icon">
                  <Icon name={editorMeta.icon} size={18} />
                </div>
                <div className="d-copy">
                  <h2>{editing.index === null ? '新增接入源' : `编辑 · ${editing.draft.name}`}</h2>
                  <div className="d-sub">
                    <span>{editorMeta.label}</span>
                    <span>·</span>
                    <span>{CATEGORY_LABEL[editorMeta.category] || editorMeta.category}</span>
                    <span>·</span>
                    <span>确认后还需点「保存变更」写入知识库</span>
                  </div>
                </div>
                <div className="d-actions">
                  <button className="icon-btn" type="button" onClick={() => setEditing(null)}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="drawer-body">
              <h3 className="drawer-section-title">基本信息</h3>
              <div className="form-grid">
                <div className="field">
                  <label>供应商</label>
                  <select
                    className="select"
                    value={editing.draft.provider}
                    disabled={editing.index !== null}
                    onChange={(event) =>
                      changeEditorProvider(event.target.value as SourceProvider)
                    }
                  >
                    {PROVIDER_ORDER.map((provider) => (
                      <option key={provider} value={provider}>
                        {PROVIDER_META[provider].label}
                      </option>
                    ))}
                  </select>
                  <span className="help">
                    {editing.index !== null
                      ? '已保存的接入源不允许更换供应商，可删除后重新添加'
                      : '供应商决定分类与连通方式'}
                  </span>
                </div>
                <div className="field">
                  <label>
                    名称 <span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    value={editing.draft.name}
                    placeholder="如 产品文档库"
                    onChange={(event) => patchEditor({ name: event.target.value })}
                  />
                </div>
              </div>

              <h3 className="drawer-section-title mt-16">访问范围</h3>
              {editing.draft.provider === 'YUQUE' ? (
                <>
                  <div className="form-grid">
                    <div className="field">
                      <label>团队空间</label>
                      <select
                        className="select"
                        value={editing.draft.scopeValues.namespace || ''}
                        onChange={(event) => void loadCatalog(event.target.value)}
                      >
                        <option value="">选择语雀团队</option>
                        {keepCurrentOption(
                          editing.draft.scopeValues.namespace,
                          (catalog?.spaces ?? []).map((space) => space.slug),
                        )}
                        {(catalog?.spaces ?? []).map((space) => (
                          <option key={space.slug} value={space.slug}>
                            {space.name}（{space.slug}）
                          </option>
                        ))}
                      </select>
                      <span className="help">只用于列出可选的语雀知识库</span>
                    </div>
                    <div className="field">
                      <label>域名</label>
                      <input
                        className="input"
                        value={editing.draft.scopeValues.apiBaseUrl || ''}
                        placeholder={YUQUE_DEFAULT_BASE_URL}
                        onChange={(event) => patchScope('apiBaseUrl', event.target.value)}
                      />
                      <span className="help">
                        默认企业域名；个人语雀改为 https://www.yuque.com/api/v2
                      </span>
                    </div>
                  </div>
                  <div className="row mt-16">
                    <button
                      className="btn"
                      type="button"
                      disabled={catalogLoading}
                      onClick={() => void loadCatalog()}
                    >
                      <Icon name="refresh" size={12} />
                      {catalogLoading ? '加载中…' : '加载团队与知识库'}
                    </button>
                    <span className="note">
                      {catalog
                        ? `已加载 ${catalog.spaces.length} 个团队${
                            catalog.books.length ? `、${catalog.books.length} 个知识库` : ''
                          }`
                        : '用当前令牌读取团队；选中团队后自动加载该团队的知识库'}
                    </span>
                  </div>

                  <div className="scope-books mt-16">
                    <div className="row between mb-8">
                      <b>同步范围</b>
                      <span className="note">
                        {editing.draft.selection.length
                          ? `已选 ${editing.draft.selection.length} 个知识库，可展开挑文章`
                          : '勾选知识库；不展开文章则整库同步'}
                      </span>
                    </div>
                    {(catalog?.books ?? []).length === 0 ? (
                      <span className="note">
                        {editing.draft.selection.length
                          ? '已选知识库保留在列表里；重新加载团队后可继续添加'
                          : '先选团队并加载，再勾选要同步的知识库'}
                      </span>
                    ) : null}
                    {(catalog?.books ?? []).map((book) => {
                      const picked = editing.draft.selection.find(
                        (item) => item.book === book.namespace,
                      );
                      const cache = docCache[book.namespace];
                      return (
                        <div className="scope-book" key={book.namespace}>
                          <div className="scope-book-row">
                            <input
                              className="checkbox"
                              type="checkbox"
                              checked={!!picked}
                              aria-label={`同步知识库 ${book.name}`}
                              onChange={() => toggleBook(book)}
                            />
                            <b>{book.name}</b>
                            <span className="note mono-sm">{book.namespace}</span>
                            <span className="tag gray sm">{book.docsCount ?? 0} 篇</span>
                            {picked ? (
                              <>
                                <span className={`tag ${picked.docs.length ? 'green' : 'gray'} sm`}>
                                  {picked.docs.length ? `已选 ${picked.docs.length} 篇` : '整库'}
                                </span>
                                <button
                                  className="btn sm"
                                  type="button"
                                  onClick={() => void loadDocs(book.namespace)}
                                >
                                  <Icon
                                    name={expandedBook === book.namespace ? 'chevron-up' : 'chevron-down'}
                                    size={11}
                                  />
                                  {expandedBook === book.namespace ? '收起文章' : '选文章'}
                                </button>
                              </>
                            ) : null}
                          </div>
                          {picked && expandedBook === book.namespace ? (
                            <div className="scope-book-docs">
                              {cache?.loading ? <span className="note">正在读取文章…</span> : null}
                              {cache && !cache.loading && cache.docs.length === 0 ? (
                                <span className="note">{cache.message || '没有读到文章'}</span>
                              ) : null}
                              {(cache?.docs ?? []).map((doc) => (
                                <label className="scope-doc" key={doc.slug}>
                                  <input
                                    className="checkbox"
                                    type="checkbox"
                                    checked={picked.docs.some((entry) => entry.slug === doc.slug)}
                                    onChange={() => toggleDoc(book.namespace, doc)}
                                  />
                                  <span>{doc.title}</span>
                                </label>
                              ))}
                              {picked.docs.length ? (
                                <span className="note">取消全部文章勾选即回到整库同步</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="form-grid">
                  {editorMeta.scopeFields.map((field) => (
                    <div className="field" key={field.key}>
                      <label>
                        {field.label}
                        {field.required ? <span className="req">*</span> : null}
                      </label>
                      <input
                        className="input"
                        value={editing.draft.scopeValues[field.key] || ''}
                        placeholder={field.placeholder}
                        onChange={(event) => patchScope(field.key, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <h3 className="drawer-section-title mt-16">凭据</h3>
              <div className="form-grid">
                <div className="field">
                  <label>凭据类型</label>
                  <select
                    className="select"
                    value={editing.draft.credentialType}
                    onChange={(event) => patchEditor({ credentialType: event.target.value })}
                  >
                    {CREDENTIAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {editing.draft.credentialType === 'BASIC' ? (
                  <div className="field">
                    <label>用户名</label>
                    <input
                      className="input"
                      value={editing.draft.credentialUsername}
                      placeholder={editing.draft.provider === 'GIT' ? 'git' : '账号'}
                      onChange={(event) => patchEditor({ credentialUsername: event.target.value })}
                    />
                  </div>
                ) : null}
                <div className="field">
                  <label>{editorMeta.secretHint}</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={editing.draft.secret}
                    placeholder={
                      editing.draft.hasSecret ? '已配置，留空继续沿用' : '填写后保存即生效'
                    }
                    onChange={(event) => patchEditor({ secret: event.target.value })}
                  />
                  <span className="help">只写不读：保存后仅回显「已配置」，不回传明文</span>
                </div>
                <div className="field">
                  <label>凭据引用（可选）</label>
                  <input
                    className="input"
                    value={editing.draft.secretRef}
                    placeholder="环境变量或系统属性名"
                    onChange={(event) => patchEditor({ secretRef: event.target.value })}
                  />
                  <span className="help">不填明文时按引用名读取</span>
                </div>
              </div>

              <div className="row mt-16">
                <input
                  className="checkbox"
                  id="source-enabled"
                  type="checkbox"
                  checked={editing.draft.enabled}
                  onChange={(event) => patchEditor({ enabled: event.target.checked })}
                />
                <label htmlFor="source-enabled" className="note">
                  启用该接入源（停用后任务侧不再读取）
                </label>
              </div>

              {PROBE_SUPPORTED.includes(editing.draft.provider) ? (
                <div className="callout mt-16">
                  <Icon name="link" size={15} />
                  <div className="ct">
                    <b>先测再存</b>
                    <p>
                      测试使用当前填写的内容；若未填新凭据，沿用已保存的那条。
                      {editorResult ? (
                        <span className={`tag ${editorResult.reachable ? 'green' : 'red'} sm`}>
                          {editorResult.message} · {editorResult.latencyMs}ms
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="callout mt-16">
                  <Icon name="info" size={15} />
                  <div className="ct">
                    <b>暂不支持连通性测试</b>
                    <p>{editorMeta.label}暂只保存配置，探测能力后续开放。</p>
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-foot">
              <button className="btn" type="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <div className="row gap-6">
                <button
                  className="btn"
                  type="button"
                  disabled={editorTesting || !PROBE_SUPPORTED.includes(editing.draft.provider)}
                  onClick={() => void testEditor()}
                >
                  <Icon name="link" size={12} />
                  {editorTesting ? '测试中…' : '测试连接'}
                </button>
                <button className="btn primary" type="button" onClick={applyEditor}>
                  <Icon name="check" size={13} />
                  {editing.index === null ? '加入列表' : '确认修改'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
