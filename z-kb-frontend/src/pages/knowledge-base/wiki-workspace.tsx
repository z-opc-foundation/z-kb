import Icon from '@/components/icon';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import AppModal from '@/components/app-modal';
import { CategoryNode, getCategoryTree } from '@/services/category';
import { MaterialRecord, pageMaterial } from '@/services/material';
import {
  generateWiki,
  getWikiDetail,
  getWikiLineage,
  listWikiPages,
  WikiDetailRecord,
  WikiLineageRecord,
  WikiPageRecord,
} from '@/services/wiki';
import WikiGraphTab from './components/wiki-graph-tab';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatShortDateTime } from '@/utils/format';

interface Props {
  kbId: string;
  canManage: boolean;
  initialWikiId?: string;
  onChanged?: () => void;
}

/** 后端 list 接口最大返回 100 条且不支持翻页，超出部分只能靠关键词检索定位。 */
const WIKI_LIST_LIMIT = 100;

const DETAIL_TABS: { key: string; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'body', label: '正文' },
  { key: 'sources', label: '来源资料' },
  { key: 'graph', label: '图谱' },
  { key: 'lineage', label: '来源证据' },
];

function flattenCategories(nodes: CategoryNode[], map = new Map<string, string>()): Map<string, string> {
  nodes.forEach((node) => {
    map.set(node.categoryId, node.name);
    if (node.children && node.children.length) {
      flattenCategories(node.children, map);
    }
  });
  return map;
}

export default function WikiWorkspace({ kbId, canManage, initialWikiId, onChanged }: Props) {
  const [pages, setPages] = useState<WikiPageRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [keyword, setKeyword] = useState('');
  const [queryKeyword, setQueryKeyword] = useState('');
  const [mode, setMode] = useState<'list' | 'catalog'>('list');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(initialWikiId || '');
  const [detail, setDetail] = useState<WikiDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('basic');
  const [lineage, setLineage] = useState<WikiLineageRecord | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genSelected, setGenSelected] = useState<string[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const loadPages = useCallback(
    async (nextKeyword?: string) => {
      setLoading(true);
      const result = await listWikiPages(kbId, nextKeyword || undefined, WIKI_LIST_LIMIT);
      setLoading(false);
      if (!result) {
        return;
      }
      setPages(result);
      setSelectedId((prev) => (result.some((page) => page.wikiId === prev) ? prev : ''));
    },
    [kbId],
  );

  const loadSupport = useCallback(async () => {
    const [materialResult, tree] = await Promise.all([
      pageMaterial({ kbId, current: 1, size: 100 }),
      getCategoryTree(kbId),
    ]);
    if (materialResult) {
      setMaterials(materialResult.records || []);
    }
    if (tree) {
      setCategories(flattenCategories(tree));
    }
  }, [kbId]);

  useEffect(() => {
    void loadPages();
    void loadSupport();
  }, [loadPages, loadSupport]);

  useEffect(() => {
    if (initialWikiId) {
      setSelectedId(initialWikiId);
    }
  }, [initialWikiId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setLineage(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailTab('basic');
    void getWikiDetail(selectedId).then((result) => {
      if (cancelled) {
        return;
      }
      setDetailLoading(false);
      setDetail(result || null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const openLineageTab = (wikiId: string) => {
    setDetailTab('lineage');
    if (lineage && lineage.wikiId === wikiId) {
      return;
    }
    void getWikiLineage({ wikiId }).then((result) => {
      if (result) {
        setLineage(result);
      }
    });
  };

  const selectWiki = (wikiId: string) => {
    setSelectedId(wikiId);
    setLineage(null);
  };

  const openGenerate = () => {
    const existing = new Set(pages.map((page) => page.materialId));
    const defaults = materials
      .filter((item) => item.parseStatus === 'READY' && !existing.has(item.materialId))
      .map((item) => item.materialId);
    setGenSelected(defaults);
    setGenOpen(true);
  };

  const submitGenerate = async () => {
    if (!genSelected.length) {
      return;
    }
    setGenBusy(true);
    const result = await generateWiki(kbId, genSelected);
    setGenBusy(false);
    if (!result) {
      return;
    }
    toast(
      result.failedCount ? 'Wiki 生成部分完成' : 'Wiki 已生成',
      `${result.successCount}/${result.totalCount} 篇成功${result.failedCount ? '，失败条目见汇总' : ''}`,
      result.failedCount ? 'warn' : 'success',
    );
    setGenOpen(false);
    await loadPages(queryKeyword);
    onChanged?.();
    const first = result.items.find((item) => item.status === 'READY' && item.wikiId);
    if (first?.wikiId) {
      selectWiki(first.wikiId);
    }
  };

  const groupOf = (materialId: string): string => {
    const material = materials.find((item) => item.materialId === materialId);
    if (material?.categoryId) {
      return categories.get(material.categoryId) || '未分类';
    }
    return material ? '未分类' : '目录未覆盖';
  };

  const catalog = useMemo(() => {
    const groups = new Map<string, WikiPageRecord[]>();
    pages.forEach((page) => {
      const name = groupOf(page.materialId);
      groups.set(name, [...(groups.get(name) || []), page]);
    });
    return Array.from(groups.entries());
  }, [pages, materials, categories]);

  const existingWikiMaterialIds = useMemo(
    () => new Set(pages.map((page) => page.materialId)),
    [pages],
  );

  const leftList = (
    <section className="panel wiki-left">
      <div className="panel-head">
        <h3>
          <Icon name="book" size={15} />
          Wiki
        </h3>
        <span className="hint">
          {pages.length >= WIKI_LIST_LIMIT
            ? `前 ${WIKI_LIST_LIMIT} 篇 · 搜索定位更多`
            : `${pages.length} 篇`}
        </span>
      </div>
      <div className="panel-body" style={{ paddingBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <div className="input-icon" style={{ flex: 1, minWidth: 0 }}>
            <span className="ic">
              <Icon name="search" size={13} />
            </span>
            <input
              className="input"
              placeholder="搜索标题或摘要"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setQueryKeyword(keyword.trim());
                  void loadPages(keyword.trim());
                }
              }}
            />
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={() => {
              setQueryKeyword(keyword.trim());
              void loadPages(keyword.trim());
            }}
          >
            搜索
          </button>
        </div>
        <div className="subtabs" style={{ marginTop: 10, marginBottom: 0 }}>
          <button
            className={`btn xs ${mode === 'list' ? 'primary-soft' : 'ghost'}`}
            type="button"
            onClick={() => setMode('list')}
          >
            列表
          </button>
          <button
            className={`btn xs ${mode === 'catalog' ? 'primary-soft' : 'ghost'}`}
            type="button"
            onClick={() => setMode('catalog')}
          >
            目录
          </button>
        </div>
      </div>
      <div className="tree">
        {loading ? (
          <div className="tree-add" style={{ cursor: 'default' }}>
            正在加载 Wiki…
          </div>
        ) : !pages.length ? (
          <div className="tree-add" style={{ cursor: 'default' }}>
            {queryKeyword ? '没有匹配的 Wiki' : '还没有生成 Wiki'}
          </div>
        ) : mode === 'list' ? (
          pages.map((page) => (
            <div
              key={page.wikiId}
              className={`tree-item ${selectedId === page.wikiId ? 'active' : ''}`}
              onClick={() => selectWiki(page.wikiId)}
            >
              <Icon name="file-text" size={13} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {page.title}
              </span>
              <span className="count">{page.pointCount}</span>
            </div>
          ))
        ) : (
          catalog.map(([group, items]) => {
            const folded = collapsed[group];
            return (
              <div key={group}>
                <div
                  className="tree-item"
                  style={{ fontWeight: 600 }}
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))}
                >
                  <Icon name={folded ? 'chevron-right' : 'chevron-down'} size={13} />
                  {group}
                  <span className="count">{items.length}</span>
                </div>
                {folded
                  ? null
                  : items.map((page) => (
                      <div
                        key={page.wikiId}
                        className={`tree-item ${selectedId === page.wikiId ? 'active' : ''}`}
                        style={{ paddingLeft: 24 }}
                        onClick={() => selectWiki(page.wikiId)}
                      >
                        <Icon name="file-text" size={13} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {page.title}
                        </span>
                        <span className="count">{page.pointCount}</span>
                      </div>
                    ))}
              </div>
            );
          })
        )}
      </div>
      <div className="panel-foot">
        <span className="mono-sm">{queryKeyword ? `关键词：${queryKeyword}` : '目录按来源资料分类'}</span>
      </div>
    </section>
  );

  const lineageGraphNodes =
    lineage && detail && lineage.wikiId === detail.page.wikiId
      ? lineage.nodes.filter(
          (node) => node.nodeType !== 'MATERIAL' && node.nodeType !== 'WIKI',
        )
      : [];

  const wikiAskQuestion = detail
    ? `请介绍 Wiki「${detail.page.title}」的要点，并标注引用来源。${
        detail.points?.[0]?.text
          ? `页面开头片段：${detail.points[0].text.replace(/\s+/g, ' ').slice(0, 60)}`
          : ''
      }`
    : undefined;

  const detailCard = detail ? (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Icon name="book" size={15} />
          {detail.page.title}
        </h3>
        <div className="btn-group">
          <span className="tag green">v{detail.page.versionNo}</span>
          <AgentAskButton
            kbId={kbId}
            className="btn xs ghost"
            label="问 AI"
            question={wikiAskQuestion}
          />
          <button className="btn xs ghost" type="button" onClick={() => setSelectedId('')}>
            返回索引
          </button>
        </div>
      </div>
      <div className="panel-body tabs-only" style={{ paddingBottom: 0 }}>
        <div className="subtabs" style={{ marginBottom: 12 }}>
          {DETAIL_TABS.map((item) => (
            <button
              key={item.key}
              className={`btn xs ${detailTab === item.key ? 'primary-soft' : 'ghost'}`}
              type="button"
              onClick={() => {
                if (item.key === 'lineage') {
                  openLineageTab(detail.page.wikiId);
                } else {
                  setDetailTab(item.key);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        {detailTab === 'basic' ? (
          <dl className="kv">
            <dt>产物标识</dt>
            <dd className="mono">{detail.page.wikiId}</dd>
            <dt>来源物料</dt>
            <dd className="mono">{detail.page.materialId}</dd>
            <dt>版本</dt>
            <dd>
              v{detail.page.versionNo} · {detail.page.status}
            </dd>
            <dt>摘要</dt>
            <dd>{detail.page.summary || '—'}</dd>
            <dt>要点 / 字数</dt>
            <dd>
              {detail.page.pointCount} 个要点 · {detail.page.charCount ?? 0} 字
            </dd>
            <dt>来源份数</dt>
            <dd>{detail.sources.length} 份</dd>
            <dt>更新时间</dt>
            <dd>{formatShortDateTime(detail.page.updateTime)}</dd>
            <dt>图谱节点</dt>
            <dd>{detail.graphNodeCount} 个</dd>
          </dl>
        ) : null}
        {detailTab === 'body' ? (
          detail.points.length ? (
            <div>
              {detail.points.map((point, index) => (
                <div className="wiki-point" key={`${point.heading}-${index}`}>
                  <h4>
                    <span className="mono-sm">{String(index + 1).padStart(2, '0')}</span>
                    {point.heading}
                  </h4>
                  <p>{point.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <b>正文为空</b>
              <p>来源资料没有可用的已解析正文。</p>
            </div>
          )
        ) : null}
        {detailTab === 'sources' ? (
          <div>
            {detail.sources.map((source) => (
              <div className="binding-row" key={source.materialId}>
                <span className="ic">
                  <Icon name="file-text" size={15} />
                </span>
                <div className="copy">
                  <b>{source.materialTitle}</b>
                  <small className="mono-sm">
                    {source.materialId} · v{source.sourceVersionNo ?? '—'}
                  </small>
                </div>
                <span className="tag blue">来源</span>
              </div>
            ))}
            {!detail.sources.length ? <p className="muted">没有来源资料。</p> : null}
          </div>
        ) : null}
        {detailTab === 'graph' ? (
          <WikiGraphTab
            kbId={kbId}
            sourceMaterialIds={detail.sources.map((source) => source.materialId)}
          />
        ) : null}
        {detailTab === 'lineage' ? (
          lineage && lineage.wikiId === detail.page.wikiId ? (
            <div>
              <div className="kb-facts" style={{ borderTop: 0, paddingTop: 0 }}>
                <div className="kb-fact">
                  <Icon name="file-text" size={13} />
                  来源资料 <b>{lineage.sourceCount}</b>
                </div>
                <span className="sep"></span>
                <div className="kb-fact">
                  <Icon name="git-branch" size={13} />
                  关系 <b>{lineage.edges.length}</b>
                </div>
                <span className="sep"></span>
                <div className="kb-fact">
                  <Icon name="share" size={13} />
                  同源图谱 <b>{lineage.graphNodeCount}</b>
                </div>
              </div>
              {lineage.edges.map((edge, index) => {
                const from = lineage.nodes.find((node) => node.nodeId === edge.fromNodeId);
                const to = lineage.nodes.find((node) => node.nodeId === edge.toNodeId);
                return (
                  <div className="binding-row" key={`${edge.fromNodeId}-${index}`}>
                    <span className="ic">
                      <Icon name="file-text" size={14} />
                    </span>
                    <div className="copy">
                      <b>{from?.label || edge.fromNodeId}</b>
                      <small>
                        {from?.nodeType} <span className="mono-sm">{edge.relation}</span>{' '}
                        {to?.label || edge.toNodeId}
                      </small>
                    </div>
                    <span className="tag gray">只读</span>
                  </div>
                );
              })}
              {lineageGraphNodes.length ? (
                <div className="panel mt-16">
                  <div className="panel-head">
                    <h3>
                      <Icon name="share" size={14} />
                      同源图谱节点
                    </h3>
                    <span className="hint">{lineageGraphNodes.length} 个</span>
                  </div>
                  <div className="panel-body" style={{ paddingTop: 0 }}>
                    {lineageGraphNodes.map((node) => (
                      <div className="binding-row" key={node.nodeId}>
                        <span className="ic">
                          <Icon name="tag" size={14} />
                        </span>
                        <div className="copy">
                          <b>{node.label || node.nodeId}</b>
                          <small className="mono-sm">
                            {node.nodeType} · {node.nodeId}
                          </small>
                        </div>
                        <span className="tag gray">召回定位</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>只读来源证据</b>
                  <p>
                    图谱节点仅用于召回定位；同源节点不是 Wiki 的下游，也不表示发布或审批关系。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">正在加载来源证据…</p>
          )
        ) : null}
      </div>
    </section>
  ) : null;

  const index = (
    <section className="panel">
      <div className="table-toolbar">
        <div className="left">
          <div className="input-icon">
            <span className="ic">
              <Icon name="search" size={13} />
            </span>
            <input
              className="input"
              placeholder="搜索 Wiki"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setQueryKeyword(keyword.trim());
                  void loadPages(keyword.trim());
                }
              }}
            />
          </div>
          <span className="hint">{queryKeyword ? `关键词：${queryKeyword}` : '按更新时间倒序'}</span>
        </div>
        {canManage ? (
          <div className="right">
            <button
              className="btn primary"
              type="button"
              disabled={!materials.some((item) => item.parseStatus === 'READY')}
              onClick={openGenerate}
            >
              <Icon name="sparkles" size={14} />
              生成 Wiki
            </button>
          </div>
        ) : null}
      </div>
      <div className="panel-body">
        {loading ? (
          <p className="muted">正在加载 Wiki…</p>
        ) : pages.length ? (
          <div className="grid grid-2">
            {pages.map((page) => (
              <article
                key={page.wikiId}
                className="panel wiki-card"
                onClick={() => selectWiki(page.wikiId)}
              >
                <div className="panel-head">
                  <h3>
                    <Icon name="file-text" size={14} />
                    {page.title}
                  </h3>
                  <span className="tag green">v{page.versionNo}</span>
                </div>
                <div className="panel-body">
                  <p className="muted" style={{ minHeight: 40 }}>
                    {page.summary || '暂无摘要'}
                  </p>
                  <div className="meta" style={{ marginTop: 10 }}>
                    <span className="tag blue">{page.pointCount} 个要点</span>
                    <span className="tag gray">{page.sourceCount ?? 0} 份来源</span>
                    <span className="mono-sm">{formatShortDateTime(page.updateTime)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="book" size={22} />
            </div>
            <b>{queryKeyword ? '没有匹配的 Wiki' : '这个库还没有 Wiki'}</b>
            <p>
              {queryKeyword
                ? '换个关键词再试，或清空搜索查看全部。'
                : '选择已解析的资料生成 Wiki，正文按标题切分为要点。'}
            </p>
            {canManage && !queryKeyword ? (
              <button className="btn primary" type="button" onClick={openGenerate}>
                <Icon name="sparkles" size={14} />
                生成 Wiki
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="wiki-layout">
      {leftList}
      <div className="wiki-main">{selectedId ? (detailLoading ? <p className="muted">正在加载详情…</p> : detailCard) : index}</div>
      {genOpen ? (
        <AppModal
          icon="sparkles"
          title="生成 Wiki"
          sub="只处理已解析资料；同一份资料重复生成时正文未变则复用，变化则版本递增"
          width={680}
          onClose={() => {
            if (!genBusy) {
              setGenOpen(false);
            }
          }}
          body={
            <div>
              <div className="btn-group" style={{ marginBottom: 12 }}>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() =>
                    setGenSelected(
                      materials
                        .filter(
                          (item) =>
                            item.parseStatus === 'READY' &&
                            !existingWikiMaterialIds.has(item.materialId),
                        )
                        .map((item) => item.materialId),
                    )
                  }
                >
                  仅选未生成
                </button>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() =>
                    setGenSelected(
                      materials
                        .filter((item) => item.parseStatus === 'READY')
                        .map((item) => item.materialId),
                    )
                  }
                >
                  全选可生成
                </button>
                <button className="btn sm ghost" type="button" onClick={() => setGenSelected([])}>
                  清空
                </button>
              </div>
              {materials.length ? (
                materials.map((item) => {
                  const ready = item.parseStatus === 'READY';
                  const existing = existingWikiMaterialIds.has(item.materialId);
                  return (
                    <label
                      className="binding-row"
                      key={item.materialId}
                      style={{ cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6 }}
                    >
                      <input
                        type="checkbox"
                        disabled={!ready}
                        checked={genSelected.includes(item.materialId)}
                        onChange={() =>
                          setGenSelected((prev) =>
                            prev.includes(item.materialId)
                              ? prev.filter((id) => id !== item.materialId)
                              : [...prev, item.materialId],
                          )
                        }
                        aria-label={`选择 ${item.title}`}
                      />
                      <div className="copy">
                        <b>{item.title}</b>
                        <small>{existing ? '已有 Wiki，内容未变会复用' : '尚未生成 Wiki'}</small>
                      </div>
                      <span className={`tag ${ready ? (existing ? 'blue' : 'green') : 'gray'}`}>
                        {ready ? (existing ? '已生成' : '可生成') : '解析未就绪'}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="muted">这个库还没有资料。</p>
              )}
            </div>
          }
          footLeft={<span>已选 {genSelected.length} 份</span>}
          footRight={
            <>
              <button className="btn ghost" type="button" onClick={() => setGenOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={genBusy || !genSelected.length}
                onClick={() => void submitGenerate()}
              >
                {genBusy ? '生成中…' : `开始生成（${genSelected.length}）`}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
