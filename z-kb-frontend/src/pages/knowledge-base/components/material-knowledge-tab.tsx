import Icon from '@/components/icon';
import {
  ExtractionItemRecord,
  ExtractionSummaryRecord,
  getExtractionByMaterial,
  MaterialExtractionRecord,
} from '@/services/extraction';
import { useEffect, useState } from 'react';
import { EvidenceTag } from './graph-meta';

interface Props {
  materialId: string;
  failureSummary?: string;
  onOpenConcept?: (conceptId: string) => void;
}

function milestoneLabel(milestone: string): string {
  if (milestone === 'M2') {
    return 'M2 已达成';
  }
  if (milestone === 'M1') {
    return 'M1 已达成';
  }
  if (milestone === 'NONE') {
    return '未达里程碑';
  }
  return milestone || '—';
}

function KnowledgeItem({
  item,
  onOpenConcept,
}: {
  item: ExtractionItemRecord;
  onOpenConcept?: (conceptId: string) => void;
}) {
  return (
    <div className="binding-row" style={{ alignItems: 'flex-start' }}>
      <span className="tag blue mono">{String(item.seq).padStart(2, '0')}</span>
      <div className="copy">
        <b>{item.title || '—'}</b>
        {item.content ? (
          <p
            style={{
              fontSize: 11.5,
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              marginTop: 4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.content}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <EvidenceTag evidence={item.evidence} />
          {item.conceptId ? (
            <button
              className={`tag ${item.conceptStatus === 'CONFIRMED' ? 'green' : 'amber'}`}
              type="button"
              title="在 Wiki 图谱中查看"
              style={{ border: 0, cursor: onOpenConcept ? 'pointer' : 'default' }}
              onClick={() => onOpenConcept?.(item.conceptId as string)}
            >
              <Icon name="share" size={11} />
              {item.conceptName || item.conceptId}
              {item.conceptStatus === 'CONFIRMED' ? ' · 已确认' : ' · 涌现中'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KnowledgeSection({
  title,
  empty,
  count,
  items,
  onOpenConcept,
}: {
  title: string;
  empty: string;
  count: number;
  items: ExtractionItemRecord[];
  onOpenConcept?: (conceptId: string) => void;
}) {
  return (
    <div className="panel mb-16">
      <div className="panel-head">
        <h3>
          <Icon name="tag" size={14} />
          {title}
        </h3>
        <span className="hint">{count} 条</span>
      </div>
      <div className="panel-body" style={{ paddingTop: 0 }}>
        {items.length ? (
          items.map((item) => (
            <KnowledgeItem
              key={`${item.seq}-${item.title || ''}`}
              item={item}
              onOpenConcept={onOpenConcept}
            />
          ))
        ) : (
          <p className="muted">{empty}</p>
        )}
      </div>
    </div>
  );
}

function SummaryBlock({ summary }: { summary?: ExtractionSummaryRecord | null }) {
  if (!summary) {
    return <p className="muted">暂无摘要。</p>;
  }
  return (
    <div className="binding-row" style={{ alignItems: 'flex-start' }}>
      <span className="ic">
        <Icon name="file-text" size={14} />
      </span>
      <div className="copy">
        <b>{summary.title || '资料摘要'}</b>
        {summary.content ? (
          <p
            style={{
              fontSize: 11.5,
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              marginTop: 4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {summary.content}
          </p>
        ) : null}
        <div style={{ marginTop: 6 }}>
          <EvidenceTag evidence={summary.evidence} />
        </div>
      </div>
    </div>
  );
}

export default function MaterialKnowledgeTab({
  materialId,
  failureSummary,
  onOpenConcept,
}: Props) {
  const [extraction, setExtraction] = useState<MaterialExtractionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExtraction(null);
    void getExtractionByMaterial(materialId).then((result) => {
      if (cancelled) {
        return;
      }
      setExtraction(result || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  if (loading) {
    return (
      <div className="empty">
        <b>正在加载知识点…</b>
      </div>
    );
  }

  if (!extraction) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <Icon name="tag" size={20} />
        </div>
        <b>暂无萃取结果</b>
        <p>资料完成编译后才会产生摘要、问句、术语与 FAQ；当前未取到萃取记录。</p>
      </div>
    );
  }

  const counts = extraction.counts;

  return (
    <div>
      <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className={`tag ${extraction.milestone === 'NONE' ? 'gray' : 'green'}`}>
          {milestoneLabel(extraction.milestone)}
        </span>
        <span className="tag gray">摘要 {counts.summary}</span>
        <span className="tag gray">问句 {counts.question}</span>
        <span className="tag gray">术语 {counts.term}</span>
        <span className="tag gray">FAQ {counts.faq}</span>
        <span className="tag gray">图谱节点 {counts.graphNode}</span>
        <span className="tag gray">图谱关系 {counts.graphEdge}</span>
        <span className="hint">本地规则抽取</span>
      </div>

      {extraction.milestone === 'M1' ? (
        <div className="callout warn mb-16">
          <Icon name="alert-triangle" size={14} />
          <div className="ct">
            <b>M2 未达成</b>
            <p>
              {failureSummary ? `编译失败说明：${failureSummary}。` : ''}
              本次未产出 M2 萃取产物；知识点与图谱由本地规则抽取，未接 Agent / LLM。
            </p>
          </div>
        </div>
      ) : null}

      <div className="panel mb-16">
        <div className="panel-head">
          <h3>
            <Icon name="file-text" size={14} />
            摘要
          </h3>
          <span className="hint">{counts.summary} 条</span>
        </div>
        <div className="panel-body" style={{ paddingTop: 0 }}>
          <SummaryBlock summary={extraction.summary} />
        </div>
      </div>

      <KnowledgeSection
        title="问句"
        empty="暂无问句。"
        count={counts.question}
        items={extraction.questions}
        onOpenConcept={onOpenConcept}
      />
      <KnowledgeSection
        title="术语"
        empty="暂无术语。"
        count={counts.term}
        items={extraction.terms}
        onOpenConcept={onOpenConcept}
      />
      <KnowledgeSection
        title="FAQ"
        empty="暂无 FAQ。"
        count={counts.faq}
        items={extraction.faqs}
        onOpenConcept={onOpenConcept}
      />

      <div className="callout">
        <Icon name="info" size={14} />
        <div className="ct">
          <p>
            以上条目均带证据引用；未接 Agent / LLM，本地规则抽取只用于召回定位，不补造未录入内容。
          </p>
        </div>
      </div>
    </div>
  );
}
