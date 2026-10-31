import Icon from '@/components/icon';
import { getGraphByMaterial, KnowledgeGraphRecord } from '@/services/graph';
import { useEffect, useMemo, useState } from 'react';
import { EvidenceTag, nodeTypeLabel } from './graph-meta';

interface Props {
  materialId: string;
}

export default function MaterialGraphTab({ materialId }: Props) {
  const [graph, setGraph] = useState<KnowledgeGraphRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGraph(null);
    void getGraphByMaterial(materialId).then((result) => {
      if (cancelled) {
        return;
      }
      setGraph(result || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const groups = useMemo(() => {
    const map = new Map<string, KnowledgeGraphRecord['nodes']>();
    (graph?.nodes || []).forEach((node) => {
      const key = node.nodeType || 'UNKNOWN';
      map.set(key, [...(map.get(key) || []), node]);
    });
    return Array.from(map.entries());
  }, [graph]);

  const nodeNames = useMemo(() => {
    const map = new Map<string, string>();
    (graph?.nodes || []).forEach((node) => {
      map.set(node.nodeId, node.name || node.nodeId);
    });
    return map;
  }, [graph]);

  if (loading) {
    return (
      <div className="empty">
        <b>正在加载图谱…</b>
      </div>
    );
  }

  if (!graph || !graph.nodes.length) {
    return (
      <div>
        <div className="empty">
          <div className="empty-icon">
            <Icon name="share" size={20} />
          </div>
          <b>本次编译未抽取到图谱节点</b>
          <p>
            图谱由编译阶段从检索块抽取；资料尚未编译或没有可用证据时会保持为空。
          </p>
        </div>
        <div className="callout">
          <Icon name="info" size={14} />
          <div className="ct">
            <p>节点与关系由编译阶段按检索块证据生成，仅用于召回定位。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="tag blue">{graph.nodeCount} 个节点</span>
        <span className="tag gray">{graph.edgeCount} 条关系</span>
        {graph.truncated ? <span className="tag amber">已截断</span> : null}
        {graph.graphSpaceKey ? (
          <span className="tag gray mono">{graph.graphSpaceKey}</span>
        ) : null}
      </div>
      <h4 className="drawer-section-title">节点（按类型分组）</h4>
      {groups.map(([type, nodes]) => (
        <div className="panel mb-12" key={type}>
          <div className="panel-head">
            <h3>
              <Icon name="share" size={14} />
              {nodeTypeLabel(type)}
            </h3>
            <span className="hint">{nodes.length} 个</span>
          </div>
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {nodes.map((node) => (
              <div className="binding-row" key={node.nodeId}>
                <span className="ic">
                  <Icon name="tag" size={14} />
                </span>
                <div className="copy">
                  <b>{node.name || node.nodeId}</b>
                  <small className="mono-sm">
                    {node.nodeId}
                    {node.conceptId ? ` · 概念 ${node.conceptId}` : ''}
                    {node.materialId ? ` · 资料 ${node.materialId}` : ''}
                  </small>
                </div>
                <EvidenceTag evidence={node.evidence} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <h4 className="drawer-section-title" style={{ marginTop: 16 }}>
        关系
      </h4>
      {graph.edges.length ? (
        <div className="panel">
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {graph.edges.map((edge) => (
              <div className="binding-row" key={edge.edgeId}>
                <span className="ic">
                  <Icon name="git-branch" size={14} />
                </span>
                <div className="copy">
                  <b>
                    {nodeNames.get(edge.sourceNodeId) || edge.sourceNodeId}
                    <span className="mono-sm"> {edge.edgeType} </span>
                    {nodeNames.get(edge.targetNodeId) || edge.targetNodeId}
                  </b>
                  <small className="mono-sm">{edge.edgeId}</small>
                </div>
                <EvidenceTag evidence={edge.evidence} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>本次编译未抽取到图谱关系。</p>
        </div>
      )}
    </div>
  );
}
