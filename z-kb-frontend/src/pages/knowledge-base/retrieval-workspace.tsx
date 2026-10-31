import Icon from '@/components/icon';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import { RetrievalHitRecord, retrieveKnowledge } from '@/services/retrieval';
import { getWikiLineage, WikiLineageRecord } from '@/services/wiki';
import { toast } from '@/utils/toast';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatShortDateTime } from '@/utils/format';

const TOP_K_OPTIONS = [5, 10, 20, 50];

const MODES = [
  { value: 'dense', label: '向量（dense） · 本期' },
  { value: 'bm25', label: '关键词（BM25） · 后续' },
  { value: 'hybrid', label: '混合（RRF） · 后续' },
  { value: 'whybrid', label: '加权混合（whybrid） · 后续' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTerms(text: string, terms: string[]): ReactNode {
  const valid = terms.filter((term) => term && term.trim().length > 0);
  if (!valid.length) {
    return text;
  }
  const pattern = new RegExp(`(${valid.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? <mark key={index}>{part}</mark> : part,
  );
}

export default function RetrievalWorkspace({ kbId }: { kbId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') || '';
  const bootedQuery = useRef(false);
  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [minScore, setMinScore] = useState(0.1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<RetrievalHitRecord[]>([]);
  const [stats, setStats] = useState<{
    candidates: number;
    scanned: number;
    tookMs: number;
    truncated: boolean;
    model: string;
    minScore: number;
  } | null>(null);
  const [lineageHit, setLineageHit] = useState<RetrievalHitRecord | null>(null);
  const [lineage, setLineage] = useState<WikiLineageRecord | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);
  useEscapeKey(() => setLineageHit(null), !!lineageHit);

  const run = useCallback(
    async (rawQuery: string, size: number, floor: number) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        toast('请输入检索内容', '向量检索需要一个问题或关键词，避免空查询返回全库块。', 'error');
        return;
      }
      setLoading(true);
      const data = await retrieveKnowledge({
        kbId,
        query: trimmed,
        topK: size,
        minScore: floor,
        mode: 'dense',
      });
      setLoading(false);
      if (!data) {
        return;
      }
      setItems(data.hits);
      setActiveQuery(trimmed);
      setStats({
        candidates: data.totalCandidates,
        scanned: data.scanned,
        tookMs: data.tookMs,
        truncated: data.truncated,
        model: data.embeddingModel,
        minScore: data.minScore,
      });
      setSearched(true);
    },
    [kbId],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(query, topK, minScore);
  };

  useEffect(() => {
    if (bootedQuery.current || !initialQuery.trim()) {
      return;
    }
    bootedQuery.current = true;
    void run(initialQuery, topK, minScore);
  }, [initialQuery, minScore, run, topK]);

  const changeTopK = (next: number) => {
    setTopK(next);
    if (searched) {
      void run(query, next, minScore);
    }
  };

  const openWiki = (hit: RetrievalHitRecord) => {
    if (!hit.wikiId) {
      return;
    }
    navigate(
      `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=wiki&wikiId=${encodeURIComponent(hit.wikiId)}`,
    );
  };

  const openMaterial = (hit: RetrievalHitRecord) => {
    navigate(
      `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=materials&materialId=${encodeURIComponent(hit.materialId)}&materialTab=draft`,
    );
  };

  const openLineage = async (hit: RetrievalHitRecord) => {
    setLineageHit(hit);
    setLineage(null);
    if (!hit.wikiId) {
      return;
    }
    setLineageLoading(true);
    const data = await getWikiLineage({ wikiId: hit.wikiId });
    setLineageLoading(false);
    setLineage(data || null);
  };

  const hint = loading
    ? '检索中…'
    : searched
      ? `「${activeQuery}」 · ${items.length} 条命中`
      : '输入问题后检索';

  return (
    <div className="retrieval-workspace">
      <div className="retrieval-bar">
        <form className="retrieval-query" onSubmit={submit}>
          <div className="input-icon">
            <span className="ic">
              <Icon name="search" size={15} />
            </span>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入问题或关键词，如：护士长的职责"
              aria-label="检索内容"
            />
          </div>
          <button className="btn primary" type="submit" disabled={loading}>
            <Icon name="search" size={14} />
            {loading ? '检索中…' : '检索'}
          </button>
        </form>
        <div className="retrieval-opts">
          <label className="opt">
            检索模式
            <select
              className="select"
              value="dense"
              onChange={() => undefined}
              aria-label="检索模式"
            >
              {MODES.map((mode) => (
                <option key={mode.value} value={mode.value} disabled={mode.value !== 'dense'}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="opt">
            topK
            <select
              className="select"
              value={topK}
              onChange={(event) => changeTopK(Number(event.target.value))}
              aria-label="topK"
            >
              {TOP_K_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="opt">
            minScore
            <input
              className="input"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={minScore}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMinScore(Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0);
              }}
              aria-label="minScore"
            />
          </label>
          <span className="note">范围固定当前库；关键词与混合模式后续开放。</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="layers" size={14} />
            检索结果
          </h3>
          <div className="actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="hint">{hint}</span>
            <AgentAskButton
              kbId={kbId}
              className="btn sm"
              label={searched ? '用 AI 总结' : '问 AI'}
              question={
                activeQuery
                  ? `请总结「${activeQuery}」相关的知识库内容，按主题给出要点，并标注引用来源。`
                  : undefined
              }
            />
          </div>
        </div>
        {stats ? (
          <div className="retrieval-opts" style={{ padding: '0 15px 10px', marginTop: 0 }}>
            <span>候选块 {stats.candidates}</span>
            <span>扫描 {stats.scanned}</span>
            <span>耗时 {stats.tookMs} ms</span>
            <span className="mono-sm">模型 {stats.model}</span>
            <span>minScore {stats.minScore}</span>
            {stats.truncated ? (
              <span className="tag amber">扫描超过 2000 块，已截断</span>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" size={22} />
            </div>
            <b>正在计算库内相似度…</b>
            <p>命中范围限于当前知识库、当前租户与当前版本产物。</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" size={22} />
            </div>
            <b>{searched ? '没有达到 minScore 的命中' : '输入问题开始检索'}</b>
            <p>
              {searched
                ? '降低 minScore 或换一种问法再试；低于阈值的块不进入命中列表。'
                : '检索只读取已索引的当前版本检索块，不引用草稿与历史版本。'}
            </p>
          </div>
        ) : (
          <div className="retrieval-results">
            {items.map((hit) => (
              <div className="result-item" key={hit.chunkId}>
                <div className="res-top">
                  <span className="result-rank">{hit.rank}</span>
                  <div className="result-main">
                    <div className="result-title">
                      <span>{highlightTerms(hit.heading || `第 ${hit.ordinal} 块`, hit.matchedTerms)}</span>
                      <span className="tag green">余弦 {hit.score.toFixed(3)}</span>
                      {hit.wikiId ? <span className="tag gray">Wiki</span> : null}
                    </div>
                    <div className="result-snippet" style={{ WebkitLineClamp: 4 }}>
                      {highlightTerms(hit.content, hit.matchedTerms)}
                    </div>
                    <div className="result-meta">
                      <span className="tag gray">
                        {hit.materialTitle || `物料 ${hit.materialId.slice(0, 8)}`}
                      </span>
                      <span>#{hit.ordinal}</span>
                      <span>{hit.charCount} 字</span>
                      <span className="tag green">已索引</span>
                      <span>索引于 {formatShortDateTime(hit.indexedAt)}</span>
                    </div>
                    <div className="result-meta" style={{ color: 'var(--muted)' }}>
                      <span>{hit.explanation}</span>
                    </div>
                    <div className="result-meta" style={{ gap: 6 }}>
                      <button
                        className="btn sm"
                        type="button"
                        disabled={!hit.wikiId}
                        title={hit.wikiId ? '打开 Wiki 并选中页面' : '该命中未生成 Wiki'}
                        onClick={() => openWiki(hit)}
                      >
                        <Icon name="book" size={12} />查看 Wiki
                      </button>
                      <button className="btn sm" type="button" onClick={() => openMaterial(hit)}>
                        <Icon name="file-text" size={12} />原文引用
                      </button>
                      <button className="btn sm" type="button" onClick={() => void openLineage(hit)}>
                        <Icon name="git-branch" size={12} />只读图谱
                      </button>
                      {hit.wikiTitle ? <span className="note">Wiki：{hit.wikiTitle}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {lineageHit ? (
        <div className="overlay drawer-overlay" onMouseDown={() => setLineageHit(null)}>
          <div
            className="drawer narrow"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <div className="d-top">
                <div className="d-icon">
                  <Icon name="git-branch" size={18} />
                </div>
                <div className="d-copy">
                  <h2>只读图谱</h2>
                  <div className="d-sub">
                    <span>{lineageHit.materialTitle || lineageHit.materialId}</span>
                    <span>·</span>
                    <span>块 #{lineageHit.ordinal}</span>
                  </div>
                </div>
                <div className="d-actions">
                  <button
                    className="close-btn"
                    type="button"
                    aria-label="关闭"
                    onClick={() => setLineageHit(null)}
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
                  <p>
                    图谱只组装既有证据：原文块 → Wiki → 同源图谱节点；
                    Wiki 与图谱节点是并列编译产物，不是上下游。
                  </p>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 11 }}>
                原文块：#{lineageHit.ordinal} · {lineageHit.heading || '无章节标题'} ·{' '}
                {lineageHit.charCount} 字
              </p>
              {!lineageHit.wikiId ? (
                <p className="note">
                  该命中未生成 Wiki，无法组装 Wiki 与图谱节点；不代表 Wiki 编译失败。
                </p>
              ) : lineageLoading ? (
                <p className="muted">正在加载图谱…</p>
              ) : lineage ? (
                <div>
                  <p className="muted" style={{ fontSize: 11 }}>
                    节点 {lineage.nodes.length} · 关系 {lineage.edges.length} ·
                    只读展示，图谱节点仅用于召回定位
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {lineage.nodes.map((node) => (
                      <div
                        key={node.nodeId}
                        className="result-item"
                        style={{ border: '1px solid var(--line)', borderRadius: 8 }}
                      >
                        <div className="result-meta" style={{ marginTop: 0 }}>
                          <span className={`tag ${node.nodeType === 'WIKI' ? 'green' : 'gray'}`}>
                            {node.nodeType}
                          </span>
                          <span>{node.label}</span>
                        </div>
                      </div>
                    ))}
                    {lineage.edges.length === 0 ? (
                      <p className="note">当前没有可展示的节点关系；图谱节点尚未生成。</p>
                    ) : (
                      lineage.edges.map((edge) => (
                        <p key={`${edge.fromNodeId}-${edge.toNodeId}`} className="note">
                          {edge.fromNodeId} → {edge.toNodeId} · {edge.relation}
                        </p>
                      ))
                    )}
                  </div>
                  <div className="result-meta" style={{ marginTop: 10 }}>
                    <button className="btn sm" type="button" onClick={() => openWiki(lineageHit)}>
                      <Icon name="book" size={12} />打开 Wiki
                    </button>
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() =>
                        navigate(
                          `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=lineage&wikiId=${encodeURIComponent(lineageHit.wikiId || '')}`,
                        )
                      }
                    >
                      <Icon name="git-branch" size={12} />完整图谱视图
                    </button>
                  </div>
                </div>
              ) : (
                <p className="note">图谱加载失败或没有可展示的数据。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
