import { Can } from '@/components/auth';
import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  KnowledgeBaseRecord,
  pageKnowledgeBase,
  removeKnowledgeBase,
} from '@/services/knowledgeBase';
import { emitKbChanged } from '@/utils/kb-events';
import { getTenantInfo } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KbFormModal from './kb-form-modal';
import KbActivityChart, { ACTIVITY_WEEKS } from './kb-activity-chart';
import { readFavorites, saveFavorites, toggleFavoriteId } from './favorites';
import { statusMeta, typeMeta } from './kb-meta';
import { formatDateTime } from '@/utils/format';
import {
  fetchKbActivityHeatmap,
  type KbActivityDay,
} from '@/services/kbActivity';

const PAGE_SIZE = 8;

type FilterKey = 'all' | 'ACTIVE' | 'ARCHIVED' | 'managed' | 'favorite';

function StatusTag({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={`tag ${meta.tag}`}>
      <i className="dot" />
      {meta.label}
    </span>
  );
}

interface KbDeleteModalProps {
  kb: KnowledgeBaseRecord;
  onClose: () => void;
  onDeleted: () => void;
}

function KbDeleteModal({ kb, onClose, onDeleted }: KbDeleteModalProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const confirmed = code.trim() === kb.code;

  const submit = async () => {
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    const result = await removeKnowledgeBase(kb.kbId);
    setSubmitting(false);
    if (result === undefined) {
      return;
    }
    toast('知识库已删除', kb.name, 'success');
    onDeleted();
  };

  return (
    <AppModal
      icon="trash"
      title={`删除知识库 · ${kb.name}`}
      sub="危险区 · 删除不可恢复"
      width={620}
      onClose={onClose}
      footLeft="删除后编码被改写，记录不再返回列表"
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn danger"
            type="button"
            disabled={!confirmed || submitting}
            onClick={submit}
          >
            <Icon name="trash" size={12} />
            确认删除
          </button>
        </>
      }
      body={
        <div>
          <div className="alert-banner target">
            <Icon name="alert-triangle" size={15} />
            <div className="txt">
              <b>危险动作：删除知识库</b>
              <span>
                {' '}
                — 请输入编码 <b className="mono">{kb.code}</b> 以确认。
              </span>
            </div>
          </div>
          <div className="callout danger">
            <Icon name="trash" size={15} />
            <div className="ct">
              <b>会级联删除</b>
              <p>该库的档案、成员权限与资料记录会一并删除，且不可恢复。</p>
            </div>
          </div>
          <div className="field mt-16">
            <label>知识库编码</label>
            <input
              className="input mono"
              value={code}
              placeholder={kb.code}
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="help">
              名称可以改，编码不会变；这是防误删的最后一道确认。
            </span>
          </div>
          <div className="callout mt-16">
            <Icon name="info" size={15} />
            <div className="ct">
              <b>只允许删除归档态</b>
              <p>后端要求 status = ARCHIVED；运行中的库请先归档。</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; kb: KnowledgeBaseRecord }
  | { type: 'delete'; kb: KnowledgeBaseRecord }
  | null;

export default function KnowledgeBaseListPage() {
  const navigate = useNavigate();
  const tenant = getTenantInfo();
  const [records, setRecords] = useState<KnowledgeBaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [activity, setActivity] = useState<Record<string, KbActivityDay[]>>({});
  const [activityLoadedKey, setActivityLoadedKey] = useState('');
  const [activityFailedKey, setActivityFailedKey] = useState('');
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await pageKnowledgeBase(
        { current: 1, size: 500 },
        { rethrow: true },
      );
      setRecords(result?.records || []);
      emitKbChanged();
    } catch (error) {
      setLoadError((error as Error).message || '服务器错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    setPage(1);
  }, [filter, keyword]);

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const byTime = String(b.updateTime || '').localeCompare(
          String(a.updateTime || ''),
        );
        return byTime !== 0
          ? byTime
          : String(b.kbId).localeCompare(String(a.kbId));
      }),
    [records],
  );

  const stats = useMemo(
    () => ({
      total: sorted.length,
      active: sorted.filter((item) => item.status === 'ACTIVE').length,
      archived: sorted.filter((item) => item.status === 'ARCHIVED').length,
      managed: sorted.filter((item) => item.canManage).length,
      favorite: sorted.filter((item) => favorites.includes(item.kbId)).length,
    }),
    [favorites, sorted],
  );

  const filtered = useMemo(() => {
    let list = sorted;
    if (filter === 'managed') {
      list = list.filter((item) => item.canManage);
    } else if (filter === 'favorite') {
      list = list.filter((item) => favorites.includes(item.kbId));
    } else if (filter !== 'all') {
      list = list.filter((item) => item.status === filter);
    }
    const query = keyword.trim().toLowerCase();
    if (query) {
      list = list.filter((item) =>
        [
          item.name,
          item.code,
          item.description || '',
          typeMeta(item.type).label,
          item.tenantCode,
          item.embeddingModel || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    }
    return list;
  }, [favorites, filter, keyword, sorted]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRecords = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const visibleKey = pageRecords.map((item) => item.kbId).join(',');

  useEffect(() => {
    if (!visibleKey) {
      return;
    }
    let cancelled = false;
    fetchKbActivityHeatmap(visibleKey.split(','), ACTIVITY_WEEKS * 7)
      .then((data) => {
        if (cancelled || !data) {
          return;
        }
        setActivity((prev) => ({ ...prev, ...data }));
        setActivityFailedKey('');
      })
      .catch(() => {
        if (!cancelled) {
          setActivityFailedKey(visibleKey);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLoadedKey(visibleKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visibleKey]);

  const toggleFavorite = (kbId: string) => {
    const next = toggleFavoriteId(favorites, kbId);
    setFavorites(next);
    toast(next.includes(kbId) ? '已收藏' : '已取消收藏', undefined, 'info');
  };

  const openDetail = (kb: KnowledgeBaseRecord) => {
    navigate(`/knowledge-bases/${encodeURIComponent(kb.kbId)}`);
  };

  const renderCard = (kb: KnowledgeBaseRecord) => {
    const favorited = favorites.includes(kb.kbId);
    return (
      <article
        key={kb.kbId}
        className="kb-card"
        onClick={() => openDetail(kb)}
        style={{ cursor: 'pointer' }}
      >
        <div className="kb-card-top">
          <div className="kb-icon">
            <Icon name={typeMeta(kb.type).icon} size={21} />
          </div>
          <div className="kb-title">
            <h3>
              <span title={kb.name}>{kb.name}</span>
            </h3>
            <span className="code">{kb.code}</span>
          </div>
          <button
            className={`fav-btn ${favorited ? 'on' : ''}`}
            type="button"
            title={favorited ? '取消收藏' : '收藏'}
            aria-pressed={favorited}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(kb.kbId);
            }}
          >
            <Icon name="star" size={15} />
          </button>
        </div>
        <div className="kb-tags">
          <span className={`tag ${kb.canManage ? 'violet' : 'gray'}`}>
            {kb.canManage ? '可管理' : '只读'}
          </span>
          <span className="tag cyan mono">
            {kb.embeddingModel || '默认模型'}
          </span>
          <StatusTag status={kb.status} />
        </div>
        <div className="kb-progress">
          <div className="top">
            <span>最近更新</span>
            <b>{formatDateTime(kb.updateTime)}</b>
          </div>
        </div>
        <div className="kb-foot">
          <KbActivityChart
            days={activity[kb.kbId]}
            pending={activityLoadedKey !== visibleKey}
            unavailable={activityFailedKey === visibleKey}
          />
          <div className="kb-foot-actions">
            {kb.canManage ? (
              <button
                type="button"
                className="kb-set"
                title="打开设置"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/knowledge-bases/${kb.kbId}/settings`);
                }}
              >
                <Icon name="settings" size={12} />
                设置
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const pager = (
    <div className="kb-list-pager">
      <span className="note">
        共 {filtered.length} 个知识库 · 第 {currentPage} / {pages} 页 ·{' '}
        {tenant.name}（{tenant.code}）· 按最近更新排序
      </span>
      <div className="pagination">
        <button
          type="button"
          title="上一页"
          aria-label="上一页"
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          <Icon name="chevron-left" size={12} />
        </button>
        {Array.from({ length: pages }, (_, index) => index + 1).map(
          (value) => (
            <button
              key={value}
              type="button"
              className={value === currentPage ? 'active' : ''}
              onClick={() => setPage(value)}
            >
              {value}
            </button>
          ),
        )}
        <button
          type="button"
          title="下一页"
          aria-label="下一页"
          disabled={currentPage >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          <Icon name="chevron-right" size={12} />
        </button>
      </div>
    </div>
  );

  const renderTable = () => (
    <section className="panel">
      <div className="table-wrap">
        <table className="list-table">
          <thead>
            <tr>
              <th>知识库</th>
              <th>类型</th>
              <th>状态</th>
              <th>嵌入模型</th>
              <th>我的权限</th>
              <th>更新于</th>
              <th>活跃度</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map((kb) => {
              const meta = statusMeta(kb.status);
              const favorited = favorites.includes(kb.kbId);
              return (
                <tr
                  key={kb.kbId}
                  className="c-pointer"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openDetail(kb)}
                >
                  <td>
                    <div className="name-cell">
                      <div className="file-tile">
                        <Icon name={typeMeta(kb.type).icon} size={14} />
                      </div>
                      <div className="nc">
                        <b>{kb.name}</b>
                        <small className="mono">{kb.code}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tag gray">{typeMeta(kb.type).label}</span>
                  </td>
                  <td>
                    <span className={`tag ${meta.tag} sm`}>{meta.label}</span>
                  </td>
                  <td className="mono-sm">{kb.embeddingModel || '—'}</td>
                  <td>{kb.canManage ? '可管理' : '只读'}</td>
                  <td className="mono-sm">{formatDateTime(kb.updateTime)}</td>
                  <td className="col-activity">
                    <KbActivityChart
                      days={activity[kb.kbId]}
                      pending={activityLoadedKey !== visibleKey}
                      unavailable={activityFailedKey === visibleKey}
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      {kb.canManage ? (
                        <button
                          className="icon-btn"
                          type="button"
                          title="设置"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/knowledge-bases/${kb.kbId}/settings`);
                          }}
                        >
                          <Icon name="settings" size={13} />
                        </button>
                      ) : null}
                      <button
                        className={`icon-btn${favorited ? ' on' : ''}`}
                        type="button"
                        title={favorited ? '取消收藏' : '收藏'}
                        aria-pressed={favorited}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(kb.kbId);
                        }}
                      >
                        <Icon name="star" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pager}
    </section>
  );

  const emptyTenant = stats.total === 0;
  const emptyFavorite = filter === 'favorite' && stats.favorite === 0;
  let results: React.ReactNode;
  if (loading) {
    results = (
      <div className="panel">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="database" size={22} />
          </div>
          <b>正在加载知识库…</b>
          <p>列表按 X-Tenant-Code 请求当前租户可见范围。</p>
        </div>
      </div>
    );
  } else if (loadError) {
    results = (
      <div className="panel">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert-triangle" size={22} />
          </div>
          <b>知识库列表加载失败</b>
          <p>{loadError}</p>
          <button className="btn primary" type="button" onClick={() => void load()}>
            重新加载
          </button>
        </div>
      </div>
    );
  } else if (!filtered.length) {
    results = (
      <div className="panel">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="inbox" size={22} />
          </div>
          <b>
            {emptyTenant
              ? '当前账号下暂无可访问的知识库'
              : emptyFavorite
                ? '还没有收藏的知识库'
                : '没有匹配的知识库'}
          </b>
          <p>
            {emptyTenant
              ? '列表只返回你是所有者或被授权的知识库；需要别人建的库可让所有者把你加入成员，或直接新建。'
              : emptyFavorite
                ? '点卡片右上角的星标即可收藏，收藏只保存在本机浏览器。'
                : '试试清空关键词或状态筛选。'}
          </p>
          {emptyTenant ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => setModal({ type: 'create' })}
            >
              <Icon name="plus" size={13} />
              在当前租户新建
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setFilter('all');
                setKeyword('');
              }}
            >
              清空筛选
            </button>
          )}
        </div>
      </div>
    );
  } else if (view === 'cards') {
    results = <div className="kb-grid">{pageRecords.map(renderCard)}</div>;
  } else {
    results = renderTable();
  }

  return (
    <div className="view kb-list-view">
      <div className="panel">
        <div className="panel-body" style={{ padding: '12px 14px' }}>
          <div className="filter-bar">
            <div className="input-icon">
              <Icon name="search" size={14} />
              <input
                className="input"
                placeholder="搜索名称、编码、类型或嵌入模型"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            {(
              [
                ['all', '全部', stats.total],
                ['ACTIVE', '运行中', stats.active],
                ['ARCHIVED', '已归档', stats.archived],
                ['managed', '我管理的', stats.managed],
                ['favorite', '我收藏的', stats.favorite],
              ] as [FilterKey, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                className={`filter-chip ${filter === key ? 'active' : ''}`}
                type="button"
                onClick={() => setFilter(key)}
              >
                {label}
                <span className="n tnum">{count}</span>
              </button>
            ))}
            <span className="spacer"></span>
            <div className="segmented sm">
              <button
                className={view === 'cards' ? 'active' : ''}
                type="button"
                onClick={() => setView('cards')}
              >
                <Icon name="grid" size={13} />
                卡片
              </button>
              <button
                className={view === 'table' ? 'active' : ''}
                type="button"
                onClick={() => setView('table')}
              >
                <Icon name="list" size={13} />
                表格
              </button>
            </div>
            <Can code="kb.create">
              <button
                className="btn sm primary"
                type="button"
                onClick={() => setModal({ type: 'create' })}
              >
                <Icon name="plus" size={13} />
                新建知识库
              </button>
            </Can>
          </div>
        </div>
      </div>

      <div className={`kb-list-results ${view}`}>{results}</div>
      {filtered.length > 0 && view !== 'table' ? pager : null}

      {modal && modal.type === 'create' ? (
        <KbFormModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      ) : null}
      {modal && modal.type === 'edit' ? (
        <KbFormModal
          mode="edit"
          kb={modal.kb}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      ) : null}
      {modal && modal.type === 'delete' ? (
        <KbDeleteModal
          kb={modal.kb}
          onClose={() => setModal(null)}
          onDeleted={() => {
            setModal(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
