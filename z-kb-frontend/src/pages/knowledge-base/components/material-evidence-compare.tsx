import Icon from '@/components/icon';
import { RetrievalChunkRecord } from '@/services/compilation';
import {
  ExtractionItemRecord,
  getExtractionByMaterial,
  MaterialExtractionRecord,
} from '@/services/extraction';
import { MaterialDetailRecord } from '@/services/material';
import { listWikiByMaterial, WikiPageRecord } from '@/services/wiki';
import { useEffect, useMemo, useState } from 'react';
import { EvidenceTag } from './graph-meta';
import MaterialDraftMarkdown from './material-draft-markdown';
import { MaterialDetailTab } from '../material-detail-tabs';

interface Props {
  materialId: string;
  detail: MaterialDetailRecord;
  chunks: RetrievalChunkRecord[];
  compilationLoading: boolean;
  onOpenTab: (tab: MaterialDetailTab) => void;
}

interface KnowledgeEvidence {
  key: string;
  title: string;
  evidence?: string | null;
}

function collectKnowledgeEvidence(
  extraction: MaterialExtractionRecord | null,
): KnowledgeEvidence[] {
  if (!extraction) {
    return [];
  }
  const result: KnowledgeEvidence[] = [];
  if (extraction.summary) {
    result.push({
      key: 'summary',
      title: extraction.summary.title || '摘要',
      evidence: extraction.summary.evidence,
    });
  }
  const groups: { prefix: string; items: ExtractionItemRecord[] }[] = [
    { prefix: '问句', items: extraction.questions || [] },
    { prefix: '术语', items: extraction.terms || [] },
    { prefix: 'FAQ', items: extraction.faqs || [] },
  ];
  groups.forEach((group) => {
    group.items.forEach((item) => {
      result.push({
        key: `${group.prefix}-${item.seq}-${item.title || ''}`,
        title: `${group.prefix} · ${item.title || '—'}`,
        evidence: item.evidence,
      });
    });
  });
  return result;
}

export default function MaterialEvidenceCompare({
  materialId,
  detail,
  chunks,
  compilationLoading,
  onOpenTab,
}: Props) {
  const [wikiPages, setWikiPages] = useState<WikiPageRecord[]>([]);
  const [extraction, setExtraction] = useState<MaterialExtractionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftView, setDraftView] = useState<'render' | 'text'>('render');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([listWikiByMaterial(materialId), getExtractionByMaterial(materialId)]).then(
      ([wikis, knowledge]) => {
        if (cancelled) {
          return;
        }
        setWikiPages(wikis || []);
        setExtraction(knowledge || null);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const knowledgeEvidence = useMemo(
    () => collectKnowledgeEvidence(extraction),
    [extraction],
  );

  const draft = detail.currentDraft;

  return (
    <div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="file-text" size={15} />
              解析稿预览
            </h3>
            <div className="row gap-8">
              {draft?.textContent ? (
                <div className="segmented sm" role="group" aria-label="解析稿显示方式">
                  <button
                    className={draftView === 'render' ? 'active' : ''}
                    type="button"
                    onClick={() => setDraftView('render')}
                  >
                    渲染
                  </button>
                  <button
                    className={draftView === 'text' ? 'active' : ''}
                    type="button"
                    onClick={() => setDraftView('text')}
                  >
                    文本
                  </button>
                </div>
              ) : null}
              {draft ? (
                <span className="tag gray">{draft.textLength} 字符</span>
              ) : (
                <span className="tag gray">无解析稿</span>
              )}
            </div>
          </div>
          <div className="panel-body">
            {draft?.textContent ? (
              draftView === 'render' ? (
                <div className="compare-draft">
                  <MaterialDraftMarkdown content={draft.textContent} />
                </div>
              ) : (
                <pre className="compare-draft-text">{draft.textContent}</pre>
              )
            ) : (
              <div className="empty">
                <b>没有解析稿</b>
                <p>当前版本还没有可核对的解析文本。</p>
              </div>
            )}
          </div>
        </section>

        <div>
          <section className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="layers" size={14} />
                检索块
              </h3>
              <button className="btn xs ghost" type="button" onClick={() => onOpenTab('compile')}>
                去编译
              </button>
            </div>
            <div className="panel-body" style={{ paddingTop: 0 }}>
              {compilationLoading ? (
                <p className="muted">正在加载检索块…</p>
              ) : chunks.length ? (
                chunks.map((chunk) => (
                  <button
                    className="binding-row"
                    key={chunk.chunkId}
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                    onClick={() => onOpenTab('compile')}
                  >
                    <span className="tag blue mono">#{chunk.ordinal}</span>
                    <div className="copy">
                      <b>{chunk.heading || `检索块 ${chunk.ordinal}`}</b>
                      <small>
                        {chunk.content.length > 90
                          ? `${chunk.content.slice(0, 90)}…`
                          : chunk.content}
                      </small>
                    </div>
                    <span className="tag gray mono">chunk:{chunk.ordinal}</span>
                  </button>
                ))
              ) : (
                <p className="muted">暂无检索块。</p>
              )}
            </div>
          </section>

          <section className="panel mb-16">
            <div className="panel-head">
              <h3>
                <Icon name="book" size={14} />
                Wiki
              </h3>
              <button className="btn xs ghost" type="button" onClick={() => onOpenTab('wiki')}>
                去 Wiki
              </button>
            </div>
            <div className="panel-body" style={{ paddingTop: 0 }}>
              {loading ? (
                <p className="muted">正在加载 Wiki…</p>
              ) : wikiPages.length ? (
                wikiPages.map((page) => (
                  <button
                    className="binding-row"
                    key={page.wikiId}
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                    onClick={() => onOpenTab('wiki')}
                  >
                    <span className="ic">
                      <Icon name="book" size={14} />
                    </span>
                    <div className="copy">
                      <b>{page.title}</b>
                      <small>
                        v{page.versionNo} · {page.pointCount} 个要点
                      </small>
                    </div>
                    <Icon name="external-link" size={12} />
                  </button>
                ))
              ) : (
                <p className="muted">暂无 Wiki。</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="tag" size={14} />
                知识点证据
              </h3>
              <button
                className="btn xs ghost"
                type="button"
                onClick={() => onOpenTab('knowledge')}
              >
                去知识点
              </button>
            </div>
            <div className="panel-body" style={{ paddingTop: 0 }}>
              {loading ? (
                <p className="muted">正在加载知识点…</p>
              ) : knowledgeEvidence.length ? (
                knowledgeEvidence.map((item) => (
                  <button
                    className="binding-row"
                    key={item.key}
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                    onClick={() => onOpenTab('knowledge')}
                  >
                    <span className="ic">
                      <Icon name="tag" size={14} />
                    </span>
                    <div className="copy">
                      <b>{item.title}</b>
                    </div>
                    <EvidenceTag evidence={item.evidence} />
                  </button>
                ))
              ) : (
                <p className="muted">暂无知识点证据。</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="callout mt-16">
        <Icon name="info" size={14} />
        <div className="ct">
          <p>
            Wiki 可能合并多份来源、知识点跨 Wiki 萃取，因此这里只并列可核对的证据，不表示「某段原文 → 某个检索块 → 某条 Wiki 句子」的逐段谱系；未录入的样本与相似度分不补造。
          </p>
        </div>
      </div>
    </div>
  );
}
