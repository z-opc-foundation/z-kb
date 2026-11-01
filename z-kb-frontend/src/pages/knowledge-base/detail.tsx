import Icon from '@/components/icon';
import AuditLogPanel from '@/components/audit-log';
import {
  getKnowledgeBase,
  KnowledgeBaseRecord,
  KnowledgeBaseType,
} from '@/services/knowledgeBase';
import { get***REMOVED***Overview, ***REMOVED***Overview } from '@/services/overview';
import { emit***REMOVED***Changed } from '@/utils/***REMOVED***-events';
import { getTenantInfo } from '@/utils/tenant';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ***REMOVED***FormModal from './***REMOVED***-form-modal';
import MaterialWorkspace from './material-workspace';
import MixEntryWorkspace from './mix-entry-workspace';
import { resolveMaterialDetailTab } from './material-detail-tabs';
import RetrievalWorkspace from './retrieval-workspace';
import TaskManager from './task-manager';
import WikiLineageWorkspace from './wiki-lineage-workspace';
import WikiWorkspace from './wiki-workspace';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import { KnowledgeAssistant } from './components/knowledge-assistant';

const FAV_STORAGE_KEY = 'z***REMOVED***.favorite-***REMOVED***s';
const ASSISTANT_STORAGE_KEY = 'z***REMOVED***.workspace-assistant';

const TYPE_META: Record<KnowledgeBaseType, { label: string; icon: string }> = {
  FILE: { label: '文件库', icon: 'file-text' },
  MIX: { label: '混合库', icon: 'layers' },
  YUQUE: { label: '语雀库', icon: 'book' },
  CODE: { label: '代码库', icon: 'code' },
  DATABASE: { label: '数据库', icon: 'database' },
};

const TAB_META: Record<string, { label: string; icon: string }> = {
  overview: { label: '概览', icon: 'bar-chart' },
  workspace: { label: '知识工作台', icon: 'grid' },
  governance: { label: '任务管理', icon: 'activity' },
  logs: { label: '操作日志', icon: 'shield-check' },
};

function typeMeta(type: KnowledgeBaseType) {
  return TYPE_META[type] || TYPE_META.FILE;
}

function statusMeta(status: string) {
  if (status === 'ACTIVE') {
    return { label: '运行中', kind: 'success', tag: 'green' };
  }
  if (status === 'ARCHIVED') {
    return { label: '已归档', kind: 'neutral', tag: 'gray' };
  }
  if (status === 'DELETING') {
    return { label: '删除中', kind: 'danger', tag: 'red' };
  }
  return { label: status || '未知', kind: 'neutral', tag: 'gray' };
}

function fmtTime(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : value;
}

function fmtDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : value;
}

function readAssistantOpen(): boolean {
  try {
    const stored = localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (stored === '0') {
      return false;
    }
    if (stored === '1') {
      return true;
    }
    // 未手动选择过时按视口决定：三栏（树 + 表格 + 助手）至少要在 1560 以上才不挤表格
    return window.innerWidth >= 1560;
  } catch (e) {
    return true;
  }
}

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ ***REMOVED***Id?: string; tab?: string }>();
  const navigate = useNavigate();
  const ***REMOVED***Id = params.***REMOVED***Id || '';
  // 可观测已并入任务管理子页签，旧深链按任务管理打开可观测子页签；tasks 是任务管理的历史路径
  const obsDeepLink = params.tab === 'observability';
  const tabAlias = params.tab === 'tasks' ? 'governance' : params.tab;
  const tab = obsDeepLink
    ? 'governance'
    : tabAlias && TAB_META[tabAlias]
      ? tabAlias
      : 'overview';

  // 权限管理页已并入设置页，旧深链转到设置页的权限分区
  useEffect(() => {
    if (params.tab === 'members') {
      navigate(`/knowledge-bases/${***REMOVED***Id}/settings?section=access`, { replace: true });
    }
  }, [***REMOVED***Id, navigate, params.tab]);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const workspaceView: 'materials' | 'wiki' | 'lineage' | 'retrieval' =
    rawView === 'wiki' || rawView === 'lineage' || rawView === 'retrieval'
      ? rawView
      : rawView === 'concepts'
        ? 'lineage'
        : 'materials';
  const rawMaterialType = searchParams.get('materialType');
  const materialType: 'DOCUMENT' | 'CODE' | 'DATA_TABLE' =
    workspaceView === 'materials'
    && (rawMaterialType === 'CODE' || rawMaterialType === 'DATA_TABLE')
      ? rawMaterialType
      : 'DOCUMENT';
  const lineageWikiId =
    workspaceView === 'lineage'
      ? searchParams.get('wikiId') || undefined
      : undefined;
  const wikiFocusId =
    workspaceView === 'wiki'
      ? searchParams.get('wikiId') || undefined
      : undefined;
  const conceptFocusId =
    workspaceView === 'lineage'
      ? searchParams.get('conceptId') || undefined
      : undefined;
  const materialTab =
    workspaceView === 'materials' ? searchParams.get('materialTab') : null;

  const [***REMOVED***, set***REMOVED***] = useState<KnowledgeBaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [stats, setStats] = useState<***REMOVED***Overview | null>(null);
  const [focusMaterialId, setFocusMaterialId] = useState('');
  const [focusBatchId, setFocusBatchId] = useState('');
  const [uploadSignal, setUploadSignal] = useState(0);
  const [lineageNodeCount, setLineageNodeCount] = useState<number | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(readAssistantOpen);
  const assistantTouched = useRef(false);

  useEffect(() => {
    if (!assistantTouched.current) {
      return;
    }
    try {
      localStorage.setItem(ASSISTANT_STORAGE_KEY, assistantOpen ? '1' : '0');
    } catch (e) {
      /* 隐私模式下 localStorage 不可写，仅当次生效 */
    }
  }, [assistantOpen]);

  useEffect(() => {
    if (workspaceView !== 'materials') {
      return;
    }
    const materialId = searchParams.get('materialId');
    if (materialId && materialId !== focusMaterialId) {
      setFocusMaterialId(materialId);
    }
  }, [focusMaterialId, searchParams, workspaceView]);

  const load = useCallback(async () => {
    if (!***REMOVED***Id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const result = await getKnowledgeBase(***REMOVED***Id);
    setLoading(false);
    if (!result) {
      setNotFound(true);
      set***REMOVED***(null);
      return;
    }
    setNotFound(false);
    set***REMOVED***(result);
    emit***REMOVED***Changed();
  }, [***REMOVED***Id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStats = useCallback(async () => {
    if (!***REMOVED***) {
      return;
    }
    const result = await get***REMOVED***Overview(***REMOVED***.***REMOVED***Id);
    if (result) {
      setStats(result);
    }
  }, [***REMOVED***]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      // 收藏是本地个人星标，写入失败不阻断页面
    }
  }, [favorites]);

  const favorited = useMemo(() => favorites.includes(***REMOVED***Id), [favorites, ***REMOVED***Id]);

  const toggleFavorite = () => {
    if (!***REMOVED***Id) {
      return;
    }
    setFavorites((prev) =>
      prev.includes(***REMOVED***Id)
        ? prev.filter((item) => item !== ***REMOVED***Id)
        : [...prev, ***REMOVED***Id],
    );
  };

  const switchTab = (nextTab: string) => {
    if (!***REMOVED***) {
      return;
    }
    const base = `/knowledge-bases/${encodeURIComponent(***REMOVED***.***REMOVED***Id)}`;
    navigate(nextTab === 'overview' ? base : `${base}/${nextTab}`);
  };

  const switchWorkspaceView = (
    next: 'materials' | 'wiki' | 'lineage' | 'retrieval',
    wikiId?: string,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'materials') {
      nextParams.delete('view');
      nextParams.delete('materialId');
      nextParams.delete('materialTab');
    } else {
      nextParams.set('view', next);
      nextParams.delete('materialType');
    }
    if (next === 'lineage' && wikiId) {
      nextParams.set('wikiId', wikiId);
    } else {
      nextParams.delete('wikiId');
    }
    nextParams.delete('conceptId');
    setSearchParams(nextParams, { replace: true });
  };

  const openMaterial = (materialId: string) => {
    setFocusMaterialId(materialId);
    if (tab !== 'workspace') {
      // 视口由路由 tab 决定，非工作台页签只改查询参数不会切页，需显式跳到工作台。
      navigate(
        `/knowledge-bases/${encodeURIComponent(***REMOVED***Id)}/workspace?materialId=${encodeURIComponent(materialId)}`,
      );
      return;
    }
    switchWorkspaceView('materials');
  };

  const openMaterialTab = (
    materialId: string,
    nextTab: 'wiki' | 'graph' | 'knowledge',
  ) => {
    setFocusMaterialId(materialId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('view');
    nextParams.delete('materialType');
    nextParams.set('materialId', materialId);
    nextParams.set('materialTab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const closeMaterialDetail = () => {
    setFocusMaterialId('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('materialId');
    nextParams.delete('materialTab');
    setSearchParams(nextParams, { replace: true });
  };

  const openConcept = (conceptId: string) => {
    setFocusMaterialId('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('materialType');
    nextParams.delete('materialId');
    nextParams.delete('materialTab');
    nextParams.delete('wikiId');
    nextParams.set('view', 'lineage');
    nextParams.set('conceptId', conceptId);
    setSearchParams(nextParams, { replace: true });
  };

  const backToList = (
    <button
      className="btn"
      type="button"
      onClick={() => navigate('/knowledge-bases')}
    >
      <Icon name="arrow-left" size={14} />
      返回知识库列表
    </button>
  );

  if (loading) {
    return (
      <div className="view">
        <div className="panel">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="database" size={22} />
            </div>
            <b>正在加载知识库…</b>
            <p>正在读取知识库信息…</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !***REMOVED***) {
    return (
      <div className="view">
        <section className="panel">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="x-circle" size={22} />
            </div>
            <b>找不到这个知识库</b>
            <p>
              深链中的 ***REMOVED***Id 不在当前租户的可见范围里，可能已被删除或无权访问。
            </p>
            <button
              className="btn"
              type="button"
              onClick={() => navigate('/knowledge-bases')}
            >
              回到知识库列表
            </button>
          </div>
        </section>
      </div>
    );
  }

  const meta = statusMeta(***REMOVED***.status);
  const type = typeMeta(***REMOVED***.type);
  const canWrite = ***REMOVED***.actions
    ? ***REMOVED***.actions.includes('material.write')
    : !!***REMOVED***.canManageDoc || !!***REMOVED***.canManage;
  const canCompile = ***REMOVED***.actions ? ***REMOVED***.actions.includes('compilation.run') : !!***REMOVED***.canManage;

  const hero = (
    <section className="***REMOVED***-hero">
      <div className="***REMOVED***-hero-main">
        <div className="***REMOVED***-icon">
          <Icon name={type.icon} size={25} />
        </div>
        <div className="***REMOVED***-hero-copy">
          <h1>
            {***REMOVED***.name} <span className={`tag ${meta.tag}`}>{meta.label}</span>
          </h1>
          <div className="meta">
            <span className="tag gray">{type.label}</span>
            <span className="tag blue mono">{***REMOVED***.tenantCode}</span>
            <span className={`tag ${***REMOVED***.canManage ? 'violet' : 'gray'}`}>
              {***REMOVED***.canManage ? '可管理' : '只读'}
            </span>
          </div>
          <p className="desc">{***REMOVED***.description || '这个知识库还没有描述。'}</p>
        </div>
        <div className="***REMOVED***-hero-actions">
          <button
            className={`btn${favorited ? ' fav-on' : ''}`}
            type="button"
            onClick={toggleFavorite}
          >
            <Icon name="star" size={14} />
            {favorited ? '已收藏' : '收藏'}
          </button>
          {***REMOVED***.canManage ? (
            <button
              className="btn"
              type="button"
              onClick={() => setEditOpen(true)}
            >
              <Icon name="edit" size={14} />
              编辑基本信息
            </button>
          ) : null}
          <button
            className="btn primary-soft"
            type="button"
            onClick={() =>
              navigate(
                `/knowledge-bases/${encodeURIComponent(***REMOVED***.***REMOVED***Id)}/evaluation`,
              )
            }
          >
            <Icon name="shield-check" size={14} />
            知识评测
          </button>
          <AgentAskButton ***REMOVED***Id={***REMOVED***.***REMOVED***Id} label="问 AI" />
          {backToList}
        </div>
      </div>
      <div className="***REMOVED***-facts">
        <div className="***REMOVED***-fact">
          <Icon name="hash" size={13} />
          编码 <b className="mono">{***REMOVED***.code}</b>
        </div>
        <span className="sep"></span>
        <div className="***REMOVED***-fact">
          <Icon name="file-text" size={13} />
          资料 <b>{stats ? stats.fileCount : '—'}</b>
        </div>
        <span className="sep"></span>
        <div className="***REMOVED***-fact">
          <Icon name="layers" size={13} />
          租户 <b>{getTenantInfo(***REMOVED***.tenantCode).name}</b>
          <span
            className="mono-sm"
            style={{ color: 'var(--muted-2)', marginLeft: 4 }}
          >
            {***REMOVED***.tenantCode}
          </span>
        </div>
        <span className="sep"></span>
        <div className="***REMOVED***-fact">
          <Icon name="user" size={13} />
          创建人 <b>actorId {***REMOVED***.ownerId}</b>
        </div>
        <span className="sep"></span>
        <div className="***REMOVED***-fact">
          <Icon name="calendar" size={13} />
          创建于 <b>{fmtDate(***REMOVED***.createTime)}</b>
        </div>
        <span className="sep"></span>
        <div className="***REMOVED***-fact">
          <Icon name="clock" size={13} />
          更新于 <b>{fmtTime(***REMOVED***.updateTime)}</b>
        </div>
      </div>
    </section>
  );

  const tabs = (
    <nav className="***REMOVED***-tabs">
      {Object.entries(TAB_META).map(([key, item]) => (
        <button
          key={key}
          type="button"
          className={`***REMOVED***-tab ${tab === key ? 'active' : ''}`}
          style={{
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          onClick={() => switchTab(key)}
        >
          <Icon name={item.icon} size={14} />
          {item.label}
        </button>
      ))}
    </nav>
  );

  const overview = (
    <div>
      <div className="mb-16">{hero}</div>

      <div className="grid grid-4 mb-16">
        <div className="stat">
          <div className="label">资料总数</div>
          <div className="value tnum">{stats ? stats.fileCount : '—'}</div>
          <div className="foot">
            <span>已登记资料</span>
          </div>
          <div className="s-icon">
            <Icon name="file-text" size={15} />
          </div>
        </div>
        <div className="stat amber">
          <div className="label">未编译</div>
          <div className="value tnum">{stats ? stats.notCompiledCount : '—'}</div>
          <div className="foot">
            <span>已完成编译的资料不算入</span>
          </div>
          <div className="s-icon">
            <Icon name="layers" size={15} />
          </div>
        </div>
        <div className="stat violet">
          <div className="label">Wiki 页面</div>
          <div className="value tnum">{stats ? stats.wikiCount : '—'}</div>
          <div className="foot">
            <span>已生成页面</span>
          </div>
          <div className="s-icon">
            <Icon name="book" size={15} />
          </div>
        </div>
        <div className="stat green">
          <div className="label">运行中任务</div>
          <div className="value tnum">{stats ? stats.runningTaskCount : '—'}</div>
          <div className="foot">
            <span>排队中与执行中的任务</span>
          </div>
          <div className="s-icon">
            <Icon name="activity" size={15} />
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="info" size={15} />
              基本信息
            </h3>
            <span className="hint">库档案</span>
          </div>
          <div className="panel-body">
            <dl className="kv">
              <dt>***REMOVED***Id</dt>
              <dd className="mono">{***REMOVED***.***REMOVED***Id}</dd>
              <dt>编码</dt>
              <dd className="mono">{***REMOVED***.code}</dd>
              <dt>类型</dt>
              <dd>{type.label}</dd>
              <dt>租户</dt>
              <dd className="mono">{***REMOVED***.tenantCode}</dd>
              <dt>创建人</dt>
              <dd>actorId {***REMOVED***.ownerId}</dd>
              <dt>创建时间</dt>
              <dd>{fmtTime(***REMOVED***.createTime)}</dd>
              <dt>更新时间</dt>
              <dd>{fmtTime(***REMOVED***.updateTime)}</dd>
              {***REMOVED***.archivedAt ? (
                <>
                  <dt>归档时间</dt>
                  <dd>{fmtTime(***REMOVED***.archivedAt)}</dd>
                </>
              ) : null}
              <dt>图谱空间</dt>
              <dd className="mono">{***REMOVED***.primaryGraphSpaceKey || '—'}</dd>
            </dl>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="clock" size={15} />
              最近资料
            </h3>
            <button
              className="btn xs"
              type="button"
              onClick={() => switchTab('workspace')}
            >
              去知识工作台
            </button>
          </div>
          <div className="panel-body flush">
            {stats?.recentMaterials?.length ? (
              stats.recentMaterials.map((item) => (
                <div
                  key={item.materialId}
                  className="binding-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openMaterial(item.materialId)}
                >
                  <span className="ic">
                    <Icon name="file-text" size={15} />
                  </span>
                  <div className="copy">
                    <b>{item.title}</b>
                    <small>
                      {item.fileExt || 'doc'} · {fmtTime(item.registeredAt)} ·{' '}
                      {item.parseStatus === 'READY' ? '已解析' : '解析未完成'}
                    </small>
                  </div>
                  <span className={`tag ${item.parseStatus === 'READY' ? 'green' : 'amber'}`}>
                    {item.parseStatus === 'READY' ? '已解析' : '待解析'}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="file-text" size={20} />
                </div>
                <b>还没有登记资料</b>
                <p>到知识工作台上传文本文件，概览会随资料登记更新。</p>
                <button
                  className="btn"
                  type="button"
                  onClick={() => switchTab('workspace')}
                >
                  打开知识工作台
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  let content = overview;
  const fillWorkspace =
    (tab === 'workspace' &&
      !(workspaceView === 'materials' && ***REMOVED***.type === 'MIX')) ||
    tab === 'governance' ||
    tab === 'logs';
  if (tab === 'workspace') {
    const isMix = ***REMOVED***.type === 'MIX';
    const showAssistant =
      !isMix && workspaceView !== 'retrieval' && assistantOpen;
    const workspaceTabs: {
      key: 'materials' | 'wiki' | 'lineage' | 'retrieval';
      label: string;
      icon: string;
      count?: number | null;
    }[] = [
      {
        key: 'materials',
        label: isMix ? '资料树' : '资料',
        icon: isMix ? 'layers' : 'file-text',
        count: stats?.fileCount,
      },
      { key: 'wiki', label: 'Wiki', icon: 'book', count: stats?.wikiCount },
      {
        key: 'lineage',
        label: 'Wiki 图谱',
        icon: 'share',
        count: lineageNodeCount,
      },
      { key: 'retrieval', label: '知识检索', icon: 'search' },
    ];
    content = (
      <div className="***REMOVED***-workspace">
        <div className="ws-head-row">
          <div className="subtabs">
            {workspaceTabs.map((item) => (
              <button
                key={item.key}
                className={`btn sm ${workspaceView === item.key ? 'primary-soft' : 'ghost'}`}
                type="button"
                onClick={() => {
                  if (item.key === 'materials') {
                    setFocusMaterialId('');
                  }
                  switchWorkspaceView(item.key);
                }}
              >
                <Icon name={item.icon} size={13} />
                {item.label}
              {item.count != null ? (
                <span className="ws-tab-count">{item.count}</span>
              ) : null}
            </button>
          ))}
          </div>
          {!isMix && workspaceView !== 'retrieval' ? (
            <button
              type="button"
              className="btn sm ghost ws-assistant-toggle"
              aria-pressed={assistantOpen}
              onClick={() => {
                assistantTouched.current = true;
                setAssistantOpen((prev) => !prev);
              }}
            >
              <Icon
                name={assistantOpen ? 'chevron-right' : 'message-square'}
                size={13}
              />
              {assistantOpen ? '收起助手' : '知识助手'}
            </button>
          ) : null}
        </div>
        <div
          className={`***REMOVED***-workspace-body${showAssistant ? '' : ' single'}${
            fillWorkspace ? ' fill' : ''
          }`}
        >
        <div className="***REMOVED***-workspace-main">
        {workspaceView === 'retrieval' ? (
          <RetrievalWorkspace ***REMOVED***Id={***REMOVED***.***REMOVED***Id} />
        ) : workspaceView === 'wiki' ? (
          <WikiWorkspace
            ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
            canManage={canWrite}
            initialWikiId={wikiFocusId}
            onChanged={() => void loadStats()}
          />
        ) : workspaceView === 'lineage' ? (
          <WikiLineageWorkspace
            ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
            initialWikiId={lineageWikiId}
            focusConceptId={conceptFocusId}
            onOpenMaterial={openMaterial}
            onCountChange={setLineageNodeCount}
          />
        ) : ***REMOVED***.type === 'MIX' && !focusMaterialId ? (
          <MixEntryWorkspace
            ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
            canWrite={canWrite}
            canCompile={canCompile}
            initialMaterialId={focusMaterialId || undefined}
            onOpenDetail={openMaterialTab}
          />
        ) : (
          <MaterialWorkspace
            ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
            canManage={!!***REMOVED***.canManage}
            canWrite={canWrite}
            canCompile={canCompile}
            materialType={materialType}
            initialMaterialId={focusMaterialId || undefined}
            onDetailClosed={***REMOVED***.type === 'MIX' ? closeMaterialDetail : undefined}
            initialDetailTab={
              materialTab ? resolveMaterialDetailTab(materialTab) : undefined
            }
            uploadSignal={uploadSignal}
            onOpenConcept={openConcept}
            onBatchCreated={(batchId) => {
              setFocusBatchId(batchId || '');
              switchTab('governance');
            }}
          />
        )}
        </div>
        {showAssistant ? (
          <KnowledgeAssistant
            ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
            ***REMOVED***Name={***REMOVED***.name}
            stats={stats}
            canWrite={canWrite}
            pageContext={{ view: workspaceView }}
            onUpload={() => {
              switchWorkspaceView('materials');
              setUploadSignal((value) => value + 1);
            }}
            onGoTasks={() => switchTab('governance')}
            onRefresh={() => void loadStats()}
          />
        ) : null}
        </div>
      </div>
    );
  } else if (tab === 'governance') {
    content = (
      <TaskManager
        ***REMOVED***Id={***REMOVED***.***REMOVED***Id}
        canManage={!!***REMOVED***.canManage}
        canCompile={canCompile}
        focusBatchId={focusBatchId || undefined}
        onFocusHandled={() => setFocusBatchId('')}
        initialTab={obsDeepLink ? 'obs' : undefined}
      />
    );
  } else if (tab === 'logs') {
    content = <AuditLogPanel type="***REMOVED***" bizRef={***REMOVED***.***REMOVED***Id} />;
  }

  return (
    <div className={`view ***REMOVED***-detail-view${fillWorkspace ? ' fill-viewport' : ''}`}>
      {tabs}
      <div className="mt-16">{content}</div>
      {editOpen ? (
        <***REMOVED***FormModal
          mode="edit"
          ***REMOVED***={***REMOVED***}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
