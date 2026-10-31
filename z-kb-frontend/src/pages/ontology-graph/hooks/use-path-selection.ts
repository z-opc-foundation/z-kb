/**
 * 路径选择状态机：自 galaxy-meta OntologyBrowse 平移。
 * 维护「节点 → 边 → 节点」交替链路的构建、自动寻路候选、
 * 回退 / 清空 / 任意节点取消、搜索参数与候选切换。
 */
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphLinkItem, GraphNodeItem, PathStep } from '../types';
import {
  findAllPaths,
  getPathEdgeKey,
  getPathEdgeOtherEnd,
  getPathNodeKey,
  type AdjacencyEntry,
} from '../utils/path-search';

export interface PathSelectionApi {
  pathSelectionMode: boolean;
  selectedPath: PathStep[];
  candidatePaths: PathStep[][];
  activePathIdx: number;
  candidatesPanelCollapsed: boolean;
  pathMaxDepth: number;
  pathMaxResults: number;
  /** 图谱点击入口：按当前模式分流（路径构建 / 单击进入路径模式） */
  handleGraphClick: (params: { dataType?: string; data?: unknown }) => void;
  handleNodeListClick: (nodeData: GraphNodeItem) => void;
  removeNodeFromPath: (nodeKey: string) => void;
  undoPathStep: () => void;
  clearPath: () => void;
  switchCandidatePath: (idx: number) => void;
  setCandidatesPanelCollapsed: (v: boolean) => void;
  setPathMaxDepth: (v: number) => void;
  setPathMaxResults: (v: number) => void;
  togglePathSelection: () => void;
  exitPathSelection: () => void;
  /** 确认链路（查看详情）：校验后回调 onConfirmChain 并退出路径模式 */
  handleConfirmChain: () => void;
}

export function usePathSelection(
  graphData: { data: GraphNodeItem[]; links: GraphLinkItem[] },
  onConfirmChain: (pathData: PathStep[]) => void,
): PathSelectionApi {
  const [pathSelectionMode, setPathSelectionMode] = useState(false);
  const [selectedPath, setSelectedPath] = useState<PathStep[]>([]);
  const [candidatePaths, setCandidatePaths] = useState<PathStep[][]>([]);
  const [activePathIdx, setActivePathIdx] = useState(0);
  const [candidatesPanelCollapsed, setCandidatesPanelCollapsed] = useState(false);
  const [pathMaxDepth, setPathMaxDepth] = useState(8);
  const [pathMaxResults, setPathMaxResults] = useState(10);

  const selectedPathRef = useRef<PathStep[]>([]);
  selectedPathRef.current = selectedPath;
  const candidatePathsRef = useRef<PathStep[][]>([]);
  candidatePathsRef.current = candidatePaths;
  const pathPrefixRef = useRef<PathStep[]>([]);
  const pathMaxDepthRef = useRef(8);
  pathMaxDepthRef.current = pathMaxDepth;
  const pathMaxResultsRef = useRef(10);
  pathMaxResultsRef.current = pathMaxResults;
  const activePathIdxRef = useRef(0);
  activePathIdxRef.current = activePathIdx;

  // 邻接表 / 节点映射：供空依赖回调内读取最新值
  const adjacencyMapRef = useRef<Map<string, AdjacencyEntry[]>>(new Map());
  const nodeDataMapRef = useRef<Map<string, GraphNodeItem>>(new Map());
  adjacencyMapRef.current = useMemo(() => {
    const map = new Map<string, AdjacencyEntry[]>();
    const addEntry = (from: string, to: string, edge: GraphLinkItem) => {
      if (!map.has(from)) map.set(from, []);
      map.get(from)!.push({ edge, neighbor: to });
    };
    for (const link of graphData.links) {
      addEntry(link.source, link.target, link);
      addEntry(link.target, link.source, link); // 双向可达
    }
    return map;
  }, [graphData]);
  nodeDataMapRef.current = useMemo(() => {
    const m = new Map<string, GraphNodeItem>();
    for (const n of graphData.data) {
      m.set(getPathNodeKey(n), n);
    }
    return m;
  }, [graphData]);

  const exitPathSelection = useCallback(() => {
    setPathSelectionMode(false);
    setSelectedPath([]);
    setCandidatePaths([]);
    setActivePathIdx(0);
  }, []);

  const togglePathSelection = useCallback(() => {
    setSelectedPath([]);
    setCandidatePaths([]);
    setActivePathIdx(0);
    setPathSelectionMode((prev) => !prev);
  }, []);

  const undoPathStep = useCallback(() => {
    setSelectedPath((prev) => prev.slice(0, -1));
    setCandidatePaths([]);
    setActivePathIdx(0);
  }, []);

  const clearPath = useCallback(() => {
    setSelectedPath([]);
    setCandidatePaths([]);
    setActivePathIdx(0);
  }, []);

  /**
   * 取消路径中的任意一个已选节点：按位置分三种情形处理——
   * 末尾节点连同其前面的边一起拆掉；中间节点截断到其前一个节点；
   * 起点丢弃自身与紧跟的边，把原第三个元素提为新起点。
   */
  const removeNodeFromPath = useCallback((nodeKey: string) => {
    if (!nodeKey) return;
    setSelectedPath((prev) => {
      const targetIdx = prev.findIndex(
        (step) => step.type === 'node' && getPathNodeKey(step.data) === nodeKey,
      );
      if (targetIdx < 0) return prev;
      if (targetIdx === prev.length - 1) {
        return targetIdx >= 2 ? prev.slice(0, targetIdx - 1) : [];
      }
      if (targetIdx === 0) {
        return prev.length >= 3 ? prev.slice(2) : [];
      }
      return prev.slice(0, targetIdx - 1);
    });
    setCandidatePaths([]);
    setActivePathIdx(0);
  }, []);

  const switchCandidatePath = useCallback((newIdx: number) => {
    const paths = candidatePathsRef.current;
    if (newIdx < 0 || newIdx >= paths.length) return;
    setActivePathIdx(newIdx);
    setSelectedPath([...pathPrefixRef.current, ...paths[newIdx]]);
  }, []);

  /** 搜索参数变更后，以相同起终点重跑候选路径搜索 */
  const rerunPathSearch = useCallback(() => {
    const prefix = pathPrefixRef.current;
    const candidates = candidatePathsRef.current;
    if (candidates.length === 0) return;
    const current = selectedPathRef.current;
    // 校验当前路径仍是「前缀 + 某条候选路径」，避免用户手动延长链路后被参数调整意外重写
    const activeLen = candidates[activePathIdxRef.current]?.length ?? 0;
    if (activeLen === 0 || current.length !== prefix.length + activeLen) return;

    const startStep = current[prefix.length];
    const endStep = current[current.length - 1];
    if (startStep?.type !== 'node' || endStep?.type !== 'node') return;
    const startKey = getPathNodeKey(startStep.data);
    const endKey = getPathNodeKey(endStep.data);
    if (!startKey || !endKey || startKey === endKey) return;

    const usedNodes = new Set<string>();
    const usedEdges = new Set<string>();
    for (const step of prefix) {
      if (step.type === 'node') {
        usedNodes.add(getPathNodeKey(step.data));
      } else {
        usedEdges.add(getPathEdgeKey(step.data));
      }
    }

    const paths = findAllPaths(
      adjacencyMapRef.current,
      nodeDataMapRef.current,
      startKey,
      endKey,
      pathMaxDepthRef.current,
      pathMaxResultsRef.current,
      usedNodes,
      usedEdges,
    );

    if (paths.length === 0) {
      setCandidatePaths([]);
      setActivePathIdx(0);
      setSelectedPath([...prefix, startStep]);
      toast('当前参数下两节点间不存在可达路径', undefined, 'info');
      return;
    }
    setCandidatePaths(paths.length === 1 ? [] : paths);
    setActivePathIdx(0);
    setSelectedPath([...prefix, ...paths[0]]);
  }, []);

  /** 参数面板改值后延迟一轮（ref 镜像同步后）重跑搜索 */
  const scheduleRerun = useCallback(() => {
    setTimeout(() => rerunPathSearch(), 0);
  }, [rerunPathSearch]);

  /**
   * 路径选择模式下处理图谱点击：按「节点 → 边 → 节点」交替校验连贯性；
   * 点击路径末尾元素等价于回退一步；点节点自动搜索两节点间路径。
   */
  const handlePathPick = useCallback(
    (params: { dataType?: string; data?: unknown }) => {
      const data = params?.data as GraphNodeItem | GraphLinkItem | undefined;
      if (!data) return;
      const isEdge = params.dataType === 'edge';
      const prev = selectedPathRef.current;
      const last = prev[prev.length - 1];
      if (isEdge) {
        const edgeData = data as GraphLinkItem;
        const edgeKey = getPathEdgeKey(edgeData);
        if (
          last &&
          last.type === 'edge' &&
          getPathEdgeKey(last.data) === edgeKey
        ) {
          setSelectedPath(prev.slice(0, -1));
          return;
        }
        if (!last) {
          toast('请先点选一个起始节点', undefined, 'warn');
          return;
        }
        if (last.type === 'edge') {
          toast('请先点选该连线另一端的节点', undefined, 'warn');
          return;
        }
        if (!getPathEdgeOtherEnd(edgeData, getPathNodeKey(last.data))) {
          toast('该连线未与上一个节点相连，请选择连贯的连线', undefined, 'warn');
          return;
        }
        if (
          prev.some(
            (s) => s.type === 'edge' && getPathEdgeKey(s.data) === edgeKey,
          )
        ) {
          toast('该连线已在当前路径中', undefined, 'warn');
          return;
        }
        // 自环边（source===target）：自动补全 node → edge → node
        const eSrc = String(edgeData?.source ?? '');
        const eTgt = String(edgeData?.target ?? '');
        if (eSrc === eTgt) {
          setSelectedPath([
            ...prev,
            { type: 'edge', data: edgeData },
            { type: 'node', data: last.data },
          ]);
          return;
        }
        setSelectedPath([...prev, { type: 'edge', data: edgeData }]);
        return;
      }
      // 节点点击
      const nodeData = data as GraphNodeItem;
      const nodeKey = getPathNodeKey(nodeData);
      if (
        last &&
        last.type === 'node' &&
        getPathNodeKey(last.data) === nodeKey
      ) {
        setSelectedPath(prev.slice(0, -1));
        return;
      }
      if (!last) {
        setSelectedPath([{ type: 'node', data: nodeData }]);
        return;
      }
      if (last.type === 'node') {
        // 自动路径填充：起点（或延伸点）已选，直接点击另一节点作为终点
        const startKey = getPathNodeKey(last.data);
        const endKey = nodeKey;
        if (startKey === endKey) return;

        const usedNodes = new Set<string>();
        const usedEdges = new Set<string>();
        for (const step of prev) {
          if (step.type === 'node') {
            const k = getPathNodeKey(step.data);
            if (k !== startKey) usedNodes.add(k);
          } else {
            usedEdges.add(getPathEdgeKey(step.data));
          }
        }

        // 终点已在路径中：不可成环，按「再点一下就取消」处理
        if (usedNodes.has(endKey)) {
          removeNodeFromPath(endKey);
          return;
        }

        const paths = findAllPaths(
          adjacencyMapRef.current,
          nodeDataMapRef.current,
          startKey,
          endKey,
          pathMaxDepthRef.current,
          pathMaxResultsRef.current,
          usedNodes,
          usedEdges,
        );

        if (paths.length === 0) {
          toast('两节点间不存在可达路径', undefined, 'info');
          return;
        }

        pathPrefixRef.current = prev.slice(0, -1);
        setCandidatePaths(paths.length === 1 ? [] : paths);
        setActivePathIdx(0);
        setSelectedPath([...prev.slice(0, -1), ...paths[0]]);
        return;
      }
      // 上一步是连线：本次节点必须是该连线的另一端
      const lastEdge = last.data as GraphLinkItem;
      const edgeSrc = String(lastEdge?.source ?? '');
      const edgeTgt = String(lastEdge?.target ?? '');
      const isSelfLoop = edgeSrc === edgeTgt;
      if (isSelfLoop && edgeSrc === nodeKey) {
        setSelectedPath([...prev, { type: 'node', data: nodeData }]);
        return;
      }
      // 路径上已有的节点走取消逻辑，避免重复推进成环
      if (
        prev.some(
          (s) => s.type === 'node' && getPathNodeKey(s.data) === nodeKey,
        )
      ) {
        removeNodeFromPath(nodeKey);
        return;
      }
      const prevNode = prev[prev.length - 2];
      const expected = getPathEdgeOtherEnd(
        lastEdge,
        getPathNodeKey(prevNode?.data),
      );
      if (!expected || expected !== nodeKey) {
        toast('该节点不是所选连线的另一端，请选择连贯的节点', undefined, 'warn');
        return;
      }
      setSelectedPath([...prev, { type: 'node', data: nodeData }]);
    },
    [removeNodeFromPath],
  );

  /**
   * 图谱点击入口（含非路径模式）：
   * 非路径模式下单击节点 → 进入路径选择模式并以该节点作为链路起点；
   * 已处于路径模式则交给 handlePathPick 做连贯校验与自动寻路。
   */
  const handleGraphClick = useCallback(
    (params: { dataType?: string; data?: unknown }) => {
      if (pathSelectionMode) {
        handlePathPick(params);
        return;
      }
      if (params.dataType === 'edge') return;
      const nodeData = params.data as GraphNodeItem | undefined;
      if (!nodeData) return;
      setPathSelectionMode(true);
      setCandidatePaths([]);
      setActivePathIdx(0);
      setSelectedPath([{ type: 'node', data: nodeData }]);
    },
    [pathSelectionMode, handlePathPick],
  );

  const handleNodeListClick = useCallback(
    (nodeData: GraphNodeItem) => {
      handleGraphClick({ dataType: 'node', data: nodeData });
    },
    [handleGraphClick],
  );

  // ESC 退出路径选择模式
  useEffect(() => {
    if (!pathSelectionMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitPathSelection();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pathSelectionMode, exitPathSelection]);

  // 图谱数据变化时清空已选路径，避免路径引用已不可见的节点
  useEffect(() => {
    setSelectedPath([]);
    setCandidatePaths([]);
    setActivePathIdx(0);
  }, [graphData]);

  // 确认链路：至少一个节点且以节点结尾即可进入详情
  const confirmRef = useRef(onConfirmChain);
  confirmRef.current = onConfirmChain;
  const confirmChain = useCallback(() => {
    const path = selectedPathRef.current;
    if (path.length < 1) {
      toast('请至少选择一个对象节点', undefined, 'warn');
      return;
    }
    if (path[path.length - 1].type !== 'node') {
      toast('链路需以节点结尾，请补选连线另一端的节点', undefined, 'warn');
      return;
    }
    confirmRef.current(path);
    exitPathSelection();
  }, [exitPathSelection]);

  return {
    pathSelectionMode,
    selectedPath,
    candidatePaths,
    activePathIdx,
    candidatesPanelCollapsed,
    pathMaxDepth,
    pathMaxResults,
    handleGraphClick,
    handleNodeListClick,
    removeNodeFromPath,
    undoPathStep,
    clearPath,
    switchCandidatePath,
    setCandidatesPanelCollapsed,
    setPathMaxDepth: (v: number) => {
      setPathMaxDepth(v);
      scheduleRerun();
    },
    setPathMaxResults: (v: number) => {
      setPathMaxResults(v);
      scheduleRerun();
    },
    togglePathSelection,
    exitPathSelection,
    handleConfirmChain: confirmChain,
  };
}
