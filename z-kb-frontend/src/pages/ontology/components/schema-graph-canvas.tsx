import Icon from '@/components/icon';
import {
  buildCategoryColorMap,
  toG6Data,
  toInstanceG6Data,
  useG6Graph,
  UNCATEGORIZED_CAT_CODE,
} from '@/components/ontology-graph';
import type { GraphData } from '@/components/ontology-graph';
import { useEffect, useMemo, useState } from 'react';
import type {
  OntologyGraphView,
  OntologyTagCategory,
} from '@/services/ontology';
import { InstanceSubgraphList } from './instance-subgraph-list';
import type { GraphLayer, SubgraphState } from '../hooks/use-graph-layers';

/** 实例层配色：与 components/ontology-graph INSTANCE_COLORS 同源的 10 色轮转。 */
const INSTANCE_PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#48b8d0',
];

const SUBGRAPH_TAG_MAX = 5;
const SUBGRAPH_LIMIT = 500;

/** vid 口径为 `{tagName}:{instanceName}`，取首段即对象类型名。 */
function tagOfVid(vid: string): string {
  return vid.split(':')[0] ?? vid;
}

interface CanvasOverlay {
  tone: 'loading' | 'failed' | 'empty';
  title: string;
  hint?: string;
  action?: () => void;
  actionText?: string;
}

function computeOverlay(args: {
  layer: GraphLayer;
  view: OntologyGraphView | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  selectedTags: string[];
  subgraph: SubgraphState;
  onReloadSubgraph: () => void;
}): CanvasOverlay | null {
  const { layer, view, loading, failed, onRetry, selectedTags, subgraph, onReloadSubgraph } =
    args;
  if (layer === 'structure') {
    if (failed) {
      return {
        tone: 'failed',
        title: '图谱加载失败',
        action: onRetry,
        actionText: '重试',
      };
    }
    if (loading || !view) {
      return { tone: 'loading', title: '正在加载 Schema 图谱…' };
    }
    if (view.nodes.length === 0) {
      return { tone: 'empty', title: '暂无对象类型，无法构成图谱' };
    }
    return null;
  }
  if (selectedTags.length === 0) {
    return {
      tone: 'empty',
      title: '尚未选择对象类型',
      hint: '返回结构层，点击或双击节点选择 1~5 个对象类型后进入实例层。',
    };
  }
  if (subgraph.failed) {
    return {
      tone: 'failed',
      title: '实例子图加载失败',
      action: onReloadSubgraph,
      actionText: '重试',
    };
  }
  if (subgraph.loading) {
    return { tone: 'loading', title: '正在加载实例子图…' };
  }
  if (!subgraph.graphBound) {
    return {
      tone: 'empty',
      title: '图库未接入',
      hint: '实例子图查询链路已就绪，图库配置下发后此处自动展示。',
    };
  }
  if (!subgraph.view || subgraph.view.nodes.length === 0) {
    return { tone: 'empty', title: '所选对象类型在图库中暂无实例' };
  }
  return null;
}

export interface GraphEdgeClickTarget {
  edgeName: string;
  srcTag?: string;
  dstTag?: string;
}

interface SchemaGraphCanvasProps {
  view: OntologyGraphView | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  categories: OntologyTagCategory[];
  layer: GraphLayer;
  selectedTags: string[];
  subgraph: SubgraphState;
  highlightCode?: string;
  onEnterInstanceLayer: () => void;
  onEnterInstanceWith: (tagName: string) => void;
  onBackToStructure: () => void;
  onReloadSubgraph: () => void;
  onNodeClick: (tagName: string) => void;
  onEdgeClick: (target: GraphEdgeClickTarget) => void;
}

/** 双层图谱画布：结构层（Schema 视图）与实例层（所选类型集合的实例子图）。 */
export function SchemaGraphCanvas({
  view,
  loading,
  failed,
  onRetry,
  onRefresh,
  categories,
  layer,
  selectedTags,
  subgraph,
  highlightCode,
  onEnterInstanceLayer,
  onEnterInstanceWith,
  onBackToStructure,
  onReloadSubgraph,
  onNodeClick,
  onEdgeClick,
}: SchemaGraphCanvasProps) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const structureData = useMemo<GraphData | null>(() => {
    if (!view) return null;
    const nodeIds = new Set(view.nodes.map((n) => n.tagName));
    const links = view.edges
      .filter(
        (e) =>
          e.srcTag &&
          e.dstTag &&
          nodeIds.has(e.srcTag) &&
          nodeIds.has(e.dstTag),
      )
      .map((e) => ({
        source: e.srcTag,
        target: e.dstTag,
        code: e.edgeName,
        value: e.edgeName,
        displayName: e.displayName || e.edgeName,
        isSelfAssoc: e.selfLoop,
      }));
    const nodeInstanceCountMap: Record<string, number> = {};
    view.nodes.forEach((n) => {
      nodeInstanceCountMap[n.tagName.toLowerCase()] =
        Number(n.instanceCount) || 0;
    });
    const categoryColorMap = buildCategoryColorMap(
      categories.map((c) => ({
        categoryCode: c.code,
        sortOrder: c.sortOrder,
      })),
    );
    return toG6Data(
      {
        data: view.nodes.map((n) => ({
          id: n.tagName,
          code: n.tagName,
          name: n.displayName || n.tagName,
          categoryCode: n.category,
        })),
        links,
      },
      nodeInstanceCountMap,
      undefined,
      categoryColorMap,
    );
  }, [view, categories]);

  const instanceData = useMemo<GraphData | null>(() => {
    const sub = subgraph.view;
    if (layer !== 'instance' || !sub) return null;
    const catIndexOf = new Map(selectedTags.map((t, i) => [t, i]));
    const degree: Record<string, number> = {};
    sub.edges.forEach((e) => {
      degree[e.srcVid] = (degree[e.srcVid] ?? 0) + 1;
      degree[e.dstVid] = (degree[e.dstVid] ?? 0) + 1;
    });
    return toInstanceG6Data(
      sub.nodes.map((n) => ({
        id: n.vid,
        name: n.name || n.vid,
        objectCode: n.tag,
        objectName: n.tag,
        category: catIndexOf.get(n.tag) ?? 0,
        value: degree[n.vid] ?? 0,
      })),
      sub.edges.map((e) => ({
        source: e.srcVid,
        target: e.dstVid,
        label: e.edgeName,
      })),
      selectedTags.map((t, i) => ({
        name: t,
        itemStyle: { color: INSTANCE_PALETTE[i % INSTANCE_PALETTE.length] },
      })),
    );
  }, [layer, subgraph.view, selectedTags]);

  const { containerRef, setData, highlightNode, clearHighlight, fitView, ready } =
    useG6Graph({
      onNodeClick: (params) => {
        const tag = layer === 'instance'
          ? String(params.data.objectCode || tagOfVid(String(params.data.id || '')))
          : String(params.data.code || params.data.id || '');
        if (tag) onNodeClick(tag);
      },
      onNodeDoubleClick: (params) => {
        if (layer !== 'structure') return;
        const tag = String(params.data.code || params.data.id || '');
        if (tag) onEnterInstanceWith(tag);
      },
      onEdgeClick: (params) => {
        const edgeName = String(params.data.code || params.data.displayName || '');
        if (!edgeName) return;
        if (layer === 'structure') {
          onEdgeClick({
            edgeName,
            srcTag: params.data.source || undefined,
            dstTag: params.data.target || undefined,
          });
        } else {
          onEdgeClick({
            edgeName,
            srcTag: tagOfVid(String(params.data.source || '')) || undefined,
            dstTag: tagOfVid(String(params.data.target || '')) || undefined,
          });
        }
      },
      tooltipFormatter: (data) => {
        const name = data.name || data.displayName || data.code || data.id;
        if (data.objectCode) {
          return `<b>${data.name || data.id}</b><br/>对象类型 ${data.objectCode}`;
        }
        if (data.source && data.target) {
          return `<b>${name}</b><br/>${data.source} → ${data.target}`;
        }
        return `<b>${name}</b>`;
      },
      // 实例层紧凑档：实例节点 30~60px 远小于结构层 52px 大节点，
      // 且孤立实例（单勾类型无边）数量大，启用网格铺开避免挤成密行
      forceLayoutOptions:
        layer === 'instance'
          ? { nodeSize: 40, linkDistance: 110, chargeStrength: -320, spreadIsolated: true }
          : undefined,
    });

  useEffect(() => {
    if (!ready) return;
    const data = layer === 'structure' ? structureData : instanceData;
    if (data) setData(data, { settle: true });
  }, [ready, layer, structureData, instanceData, setData]);

  // 离开实例层时复位列表/图谱视图，避免结构层残留列表态
  useEffect(() => {
    if (layer !== 'instance') setViewMode('graph');
  }, [layer]);

  useEffect(() => {
    if (!highlightCode) {
      clearHighlight();
      return;
    }
    highlightNode(highlightCode);
  }, [highlightCode, clearHighlight, highlightNode, layer, structureData, instanceData]);

  const structureLegend = useMemo(() => {
    if (layer !== 'structure' || !view) return [];
    const colorMap = buildCategoryColorMap(
      categories.map((c) => ({
        categoryCode: c.code,
        sortOrder: c.sortOrder,
      })),
    );
    const used = new Set(
      view.nodes.map((n) => n.category || UNCATEGORIZED_CAT_CODE),
    );
    const items = categories
      .filter((c) => used.has(c.code))
      .map((c) => ({
        name: c.categoryName,
        color: colorMap.get(c.code)?.fill ?? '',
      }));
    if (used.has(UNCATEGORIZED_CAT_CODE)) {
      items.push({
        name: '未分类',
        color: colorMap.get(UNCATEGORIZED_CAT_CODE)?.fill ?? '',
      });
    }
    return items;
  }, [layer, view, categories]);

  const instanceLegend =
    layer === 'instance'
      ? selectedTags.map((t, i) => ({
          name: t,
          color: INSTANCE_PALETTE[i % INSTANCE_PALETTE.length],
        }))
      : [];

  const overlay = computeOverlay({
    layer,
    view,
    loading,
    failed,
    onRetry,
    selectedTags,
    subgraph,
    onReloadSubgraph,
  });

  const activeLegend = layer === 'structure' ? structureLegend : instanceLegend;
  const hasData =
    layer === 'structure' ? !!structureData : !!instanceData;

  return (
    <section className="panel ont-canvas">
      <div className="panel-head ont-canvas-head">
        <h3>
          <Icon name="git-branch" size={14} />
          {layer === 'structure' ? '结构图谱' : '实例子图'}
        </h3>
        <div className="ont-canvas-tools">
          <div className="ont-layer-switch">
            <button
              type="button"
              className={`ont-layer-btn${layer === 'structure' ? ' active' : ''}`}
              onClick={onBackToStructure}
            >
              结构层
            </button>
            <button
              type="button"
              className={`ont-layer-btn${layer === 'instance' ? ' active' : ''}`}
              disabled={selectedTags.length === 0}
              title={
                selectedTags.length === 0
                  ? '先选择 1~5 个对象类型'
                  : `查看所选 ${selectedTags.length} 个对象类型的实例子图`
              }
              onClick={onEnterInstanceLayer}
            >
              实例层
            </button>
          </div>
          {layer === 'instance' ? (
            <div className="ont-layer-switch" title="切换实例子图的展示形态">
              <button
                type="button"
                className={`ont-layer-btn${viewMode === 'graph' ? ' active' : ''}`}
                onClick={() => setViewMode('graph')}
              >
                图谱
              </button>
              <button
                type="button"
                className={`ont-layer-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                列表
              </button>
            </div>
          ) : null}
          <button
            className="btn xs ghost"
            type="button"
            title="重新加载当前层数据"
            onClick={layer === 'structure' ? onRefresh : onReloadSubgraph}
          >
            <Icon name="refresh" size={12} />
            刷新
          </button>
          <button
            className="btn xs ghost"
            type="button"
            title="恢复默认布局与缩放"
            onClick={fitView}
          >
            <Icon name="maximize" size={12} />
            视图重置
          </button>
        </div>
      </div>

      {layer === 'instance' ? (
        <div className="ont-instance-bar">
          <span className="hint">对象类型集合</span>
          {selectedTags.map((tag) => (
            <span className="tag blue sm" key={tag}>
              {tag}
            </span>
          ))}
          <button
            className="btn xs ghost"
            type="button"
            onClick={onBackToStructure}
          >
            返回结构层
          </button>
          {subgraph.view?.truncated ? (
            <span className="tag amber sm" title={`结果超出限额，已截断至 ${SUBGRAPH_LIMIT} 条`}>
              已截断
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ont-canvas-body">
        <div className="ont-canvas-container" ref={containerRef} />
        {/* 列表以绝对定位覆盖画布而非 display:none 隐藏容器——
            G6 画布 display:none 后恢复不触发重绘，会留白 */}
        {layer === 'instance' && viewMode === 'list' && subgraph.view ? (
          <InstanceSubgraphList view={subgraph.view} />
        ) : null}
        {overlay ? (
          <div className="ont-canvas-overlay">
            <b>{overlay.title}</b>
            {overlay.hint ? <span>{overlay.hint}</span> : null}
            {overlay.action ? (
              <button className="btn xs ghost" type="button" onClick={overlay.action}>
                {overlay.actionText}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasData && activeLegend.length > 0 && !(layer === 'instance' && viewMode === 'list') ? (
        <div className="ont-canvas-legend">
          {activeLegend.map((item) => (
            <span className="ont-legend-item" key={item.name}>
              <i style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
          <span className="ont-legend-tip">
            {layer === 'structure'
              ? '单击节点查实例 · 双击进入实例层 · 单击连线查关系实例'
              : `节点为实例，颜色按对象类型区分，限额 ${SUBGRAPH_LIMIT} 条 / 最多 ${SUBGRAPH_TAG_MAX} 类`}
          </span>
        </div>
      ) : null}
    </section>
  );
}
