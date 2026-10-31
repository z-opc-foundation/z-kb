import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import { ConceptDetailRecord, getConcept } from '@/services/concept';
import { useEffect, useState } from 'react';

interface Props {
  kbId: string;
  conceptId: string;
  onClose: () => void;
  onOpenMaterial?: (materialId: string) => void;
  onOpenMaterialGraph?: (materialId: string) => void;
}

function statusMeta(status: string) {
  if (status === 'CONFIRMED') {
    return { label: '已确认', tag: 'green' };
  }
  if (status === 'EMERGING') {
    return { label: '涌现中', tag: 'amber' };
  }
  return { label: status || '未知', tag: 'gray' };
}

function evidenceChunk(evidence?: string | null): string {
  if (!evidence) {
    return '—';
  }
  try {
    const parsed = JSON.parse(evidence) as { chunk?: number; start?: number; end?: number };
    if (typeof parsed.chunk === 'number') {
      return `块 ${parsed.chunk} · ${parsed.start ?? 0}-${parsed.end ?? 0}`;
    }
  } catch (e) {
    // 证据 JSON 由后端生成，解析失败时直接展示原文
  }
  return evidence;
}

export default function ConceptDetailModal({
  kbId,
  conceptId,
  onClose,
  onOpenMaterial,
  onOpenMaterialGraph,
}: Props) {
  const [detail, setDetail] = useState<ConceptDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    void getConcept(kbId, conceptId).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result) {
        setDetail(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [kbId, conceptId]);

  return (
    <AppModal
      icon="share"
      title={detail ? `概念 · ${detail.concept.name}` : '正在加载概念…'}
      sub={detail?.concept.conceptId || conceptId}
      width={760}
      onClose={onClose}
      footLeft={
        detail ? (
          <span className="mono-sm">{detail.concept.graphNodeId || '未关联图谱节点'}</span>
        ) : undefined
      }
      footRight={
        <button className="btn" type="button" onClick={onClose}>
          关闭
        </button>
      }
      body={
        loading || !detail ? (
          <div className="empty">
            <b>正在加载…</b>
          </div>
        ) : (
          <div>
            <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`tag ${statusMeta(detail.concept.status).tag}`}>
                {statusMeta(detail.concept.status).label}
              </span>
              <span className="tag blue">提及 {detail.concept.mentionCount}</span>
              <span className="tag gray">来源资料 {detail.concept.materialCount}</span>
              <span className="tag cyan mono">{detail.concept.graphNodeId || '无图谱节点'}</span>
            </div>
            {detail.concept.definition ? (
              <div className="callout mb-12">
                <Icon name="tag" size={14} />
                <div className="ct">
                  <b>概念定义</b>
                  <p>{detail.concept.definition}</p>
                </div>
              </div>
            ) : null}
            <h4 className="drawer-section-title">来源资料提及</h4>
            {detail.mentions.length ? (
              <div className="panel">
                <div className="panel-body" style={{ paddingTop: 0 }}>
                  {detail.mentions.map((mention) => (
                    <div className="binding-row" key={mention.mentionId}>
                      <span className="ic">
                        <Icon name="file-text" size={14} />
                      </span>
                      <div className="copy">
                        <b>{mention.materialTitle || mention.materialId}</b>
                        <small className="mono-sm">
                          {mention.materialId} · 出现 {mention.occurrenceCount} 次 · 证据{' '}
                          {evidenceChunk(mention.evidence)}
                        </small>
                      </div>
                      <div className="row gap-8">
                        {onOpenMaterial ? (
                          <button
                            className="btn xs"
                            type="button"
                            onClick={() => onOpenMaterial(mention.materialId)}
                          >
                            资料
                          </button>
                        ) : null}
                        {onOpenMaterialGraph ? (
                          <button
                            className="btn xs"
                            type="button"
                            onClick={() => onOpenMaterialGraph(mention.materialId)}
                          >
                            图谱
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty">
                <p>这条概念还没有来源提及。</p>
              </div>
            )}
          </div>
        )
      }
    />
  );
}
