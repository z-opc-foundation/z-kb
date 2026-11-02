import Icon from '@/components/icon';
import { getGraphByKb, KnowledgeGraphRecord } from '@/services/graph';
import { useEffect, useMemo, useState } from 'react';
import { EvidenceTag, nodeTypeLabel } from './graph-meta';

interface Props {
  kbId: string;
  sourceMaterialIds: string[];
}

export default function WikiGraphTab({ kbId, sourceMaterialIds }: Props) {
  const [graph, setGraph] = useState<KnowledgeGraphRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGraph(null);
    void getGraphByKb(kbId).then((result) => {
      if (cancelled) {
        return;
      }
      setGraph(result || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const sourceKey = sourceMaterialIds.join('|');

  const { nodes, edges } = useMemo(() => {
    const sourceSet = new Set(sourceKey ? sourceKey.split('|') : []);
    const matchedNodes = (graph?.nodes || []).filter(
      (node) => node.materialId && sourceSet.has(node.materialId),
    );
    const nodeIds = new Set(matchedNodes.map((node) => node.nodeId));
    const matchedEdges = (graph?.edges || []).filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
    );
    return { nodes: matchedNodes, edges: matchedEdges };
  }, [graph, sourceKey]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    nodes.forEach((node) => {
      const key = node.nodeType || 'UNKNOWN';
      map.set(key, [...(map.get(key) || []), node]);
    });
    return Array.from(map.entries());
  }, [nodes]);

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
        <b>正在加载同源图谱…</b>
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div>
        <div className="empty">
          <div className="empty-icon">
            <Icon name="share" size={20} />
          </div>
          <b>该 Wiki 来源资料暂无图谱节点</b>
          <p>
            图谱节点由来源资料编译时抽取生成；没有证据或尚未编译时保持为空。
          </p>
        </div>
        <div className="callout">
          <Icon name="info" size={14} />
          <div className="ct">
            <p>节点与关系由来源资料编译时的抽取结果生成，仅用于召回定位。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="tag blue">{nodes.length} 个同源节点</span>
        <span className="tag gray">{edges.length} 条关系</span>
        <span className="tag gray">库内 {graph?.nodeCount ?? 0} 个节点</span>
        {graph?.truncated ? <span className="tag amber">库内图谱已截断</span> : null}
      </div>

      {groups.map(([type, items]) => (
        <div className="panel mb-12" key={type}>
          <div className="panel-head">
            <h3>
              <Icon name="share" size={14} />
              {nodeTypeLabel(type)}
            </h3>
            <span className="hint">{items.length} 个</span>
          </div>
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {items.map((node) => (
              <div className="binding-row" key={node.nodeId}>
                <span className="ic">
                  <Icon name="tag" size={14} />
                </span>
                <div className="copy">
                  <b>{node.name || node.nodeId}</b>
                  <small className="mono-sm">
                    {node.nodeId}
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
        同源关系
      </h4>
      {edges.length ? (
        <div className="panel">
          <div className="panel-body" style={{ paddingTop: 0 }}>
            {edges.map((edge) => (
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
        <p className="muted">同源节点之间暂无可展示关系。</p>
      )}
    </div>
  );
}
