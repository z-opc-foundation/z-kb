import { useCallback, useEffect, useState } from 'react';
import {
  queryOntologySubgraph,
  type OntologySubgraphView,
} from '@/services/ontology';

export type GraphLayer = 'structure' | 'instance';

export interface SubgraphState {
  loading: boolean;
  failed: boolean;
  graphBound: boolean;
  view: OntologySubgraphView | null;
}

export interface ToggleEdgeResult {
  /** 勾边成功时自动补选的端点对象类型。 */
  added: string[];
}

const INITIAL: SubgraphState = {
  loading: false,
  failed: false,
  graphBound: true,
  view: null,
};

/**
 * 图谱层状态机：结构层（schema 视图，父级传入）与实例层（所选对象类型集合的实例子图）。
 *
 * - 结构层切换实例层需先选 tag（toggleTag / toggleEdge 维护多选集合，类型 1~5 个）
 * - 勾选关系类型自动补选其端点对象类型（占类型名额，超上限拒绝）；取消类型联动取消
 *   端点涉及该类型的边（边离开端点类型无法成立）
 * - 勾了边时 edgeNames 过滤生效：子图只含所选关系类型的实例边
 * - 实例子图 limit 默认 500，超过即 truncated=true（服务端截断）
 * - graphBound=false 是图库未接入的正常降级态，面板展示提示而非报错
 */
export function useGraphLayers(subgraphTagMax = 5) {
  const [layer, setLayer] = useState<GraphLayer>('structure');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [edgeEndpoints, setEdgeEndpoints] = useState<Record<string, string[]>>({});
  const [subgraph, setSubgraph] = useState<SubgraphState>(INITIAL);
  const [reloadTick, setReloadTick] = useState(0);

  const isTagSelected = useCallback(
    (tagName: string) => selectedTags.includes(tagName),
    [selectedTags],
  );

  const isEdgeSelected = useCallback(
    (edgeName: string) => selectedEdges.includes(edgeName),
    [selectedEdges],
  );

  const toggleTag = useCallback(
    (tagName: string) => {
      setSelectedTags((prev) => {
        if (prev.includes(tagName)) {
          return prev.filter((name) => name !== tagName);
        }
        if (prev.length >= subgraphTagMax) {
          return prev;
        }
        return [...prev, tagName];
      });
      const dropped = selectedEdges.filter(
        (name) => (edgeEndpoints[name] ?? []).includes(tagName),
      );
      if (dropped.length > 0) {
        setSelectedEdges((prev) => prev.filter((name) => !dropped.includes(name)));
        setEdgeEndpoints((prev) => {
          const next = { ...prev };
          dropped.forEach((name) => delete next[name]);
          return next;
        });
      }
    },
    [selectedEdges, edgeEndpoints, subgraphTagMax],
  );

  /**
   * 勾选/取消关系类型。勾选时自动补选其全部端点对象类型（占类型名额）。
   * @returns 超出类型上限返回 null（调用方提示）；成功返回自动补选的类型列表。
   */
  const toggleEdge = useCallback(
    (edgeName: string, endpointTags: string[]): ToggleEdgeResult | null => {
      if (selectedEdges.includes(edgeName)) {
        setSelectedEdges((prev) => prev.filter((name) => name !== edgeName));
        setEdgeEndpoints((prev) => {
          const next = { ...prev };
          delete next[edgeName];
          return next;
        });
        return { added: [] };
      }
      const missing = endpointTags.filter((t) => !selectedTags.includes(t));
      if (selectedTags.length + missing.length > subgraphTagMax) {
        return null;
      }
      setSelectedEdges((prev) => [...prev, edgeName]);
      setEdgeEndpoints((prev) => ({ ...prev, [edgeName]: endpointTags }));
      if (missing.length > 0) {
        setSelectedTags((prev) => [...prev, ...missing]);
      }
      return { added: missing };
    },
    [selectedTags, selectedEdges, subgraphTagMax],
  );

  const clearTags = useCallback(() => {
    setSelectedTags([]);
    setSelectedEdges([]);
    setEdgeEndpoints({});
  }, []);

  useEffect(() => {
    if (layer !== 'instance') {
      setSubgraph(INITIAL);
      return;
    }
    if (selectedTags.length === 0) {
      setSubgraph(INITIAL);
      return;
    }
    let stale = false;
    setSubgraph((prev) => ({ ...prev, loading: true, failed: false }));
    // 未勾边时不传 edgeNames（后端按类型集合内部全约束对枚举）
    const query =
      selectedEdges.length > 0
        ? { tagNames: selectedTags, edgeNames: selectedEdges, limit: 500 }
        : { tagNames: selectedTags, limit: 500 };
    queryOntologySubgraph(query).then((view) => {
      if (stale) return;
      if (!view) {
        setSubgraph({
          loading: false,
          failed: true,
          graphBound: true,
          view: null,
        });
        return;
      }
      setSubgraph({
        loading: false,
        failed: false,
        graphBound: view.graphBound,
        view,
      });
    });
    return () => {
      stale = true;
    };
  }, [layer, selectedTags, selectedEdges, reloadTick]);

  const enterInstanceLayer = useCallback(() => {
    setLayer('instance');
  }, []);

  /** 双击结构层节点进入实例层：目标 tag 不在选中集合时补选（不覆盖既有多选）。 */
  const enterInstanceWith = useCallback(
    (tagName: string) => {
      setSelectedTags((prev) =>
        prev.includes(tagName) || prev.length >= subgraphTagMax
          ? prev
          : [...prev, tagName],
      );
      setLayer('instance');
    },
    [subgraphTagMax],
  );

  const reloadSubgraph = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

  const backToStructureLayer = useCallback(() => {
    setLayer('structure');
    setSelectedTags([]);
    setSelectedEdges([]);
    setEdgeEndpoints({});
    setSubgraph(INITIAL);
  }, []);

  return {
    layer,
    selectedTags,
    selectedEdges,
    subgraph,
    isTagSelected,
    isEdgeSelected,
    toggleTag,
    toggleEdge,
    clearTags,
    enterInstanceLayer,
    enterInstanceWith,
    reloadSubgraph,
    backToStructureLayer,
  };
}
