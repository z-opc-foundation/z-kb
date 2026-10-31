/**
 * 路径搜索纯函数：自 galaxy-meta ontology.tsx 平移。
 * findAllPaths 为 DFS + 深度 / 数量限制 + 排除集，
 * 返回 [node, edge, node, ...] 交替出现的 PathStep[]。
 */
import type { GraphLinkItem, GraphNodeItem, PathStep } from '../types';

/** 取节点唯一键：优先 code，其次 id / name */
export function getPathNodeKey(node: unknown): string {
  const d = node as { code?: string; id?: string; name?: string } | null;
  return String(d?.code ?? d?.id ?? d?.name ?? '');
}

/** 取节点展示名：优先 name（中文显示名），其次 code */
export function getPathNodeLabel(node: unknown): string {
  const d = node as { name?: string; code?: string; id?: string } | null;
  return String(d?.name ?? d?.code ?? d?.id ?? '');
}

/** 取连线唯一键：source→target + 关系类型，保证同源同宿的多重关系可区分 */
export function getPathEdgeKey(edge: unknown): string {
  const d = edge as { source?: string; target?: string; value?: string; code?: string } | null;
  return `${d?.source ?? ''}->${d?.target ?? ''}::${d?.value ?? d?.code ?? ''}`;
}

/** 取连线展示名：优先中文 displayName，其次原始 edgeType */
export function getPathEdgeLabel(edge: unknown): string {
  const d = edge as { displayName?: string; value?: string; code?: string } | null;
  return String(d?.displayName ?? d?.value ?? d?.code ?? '');
}

/** 从一条候选路径中提取用于卡片展示的元数据 */
export function getCandidatePathMeta(path: PathStep[]) {
  const nodeCount = path.filter((s) => s.type === 'node').length;
  const edgeCount = path.filter((s) => s.type === 'edge').length;
  const startNode = path[0];
  const endNode = path[path.length - 1];
  const startName =
    startNode?.type === 'node' ? getPathNodeLabel(startNode.data) : '';
  const endName =
    endNode?.type === 'node' ? getPathNodeLabel(endNode.data) : '';
  const summary = path
    .map((s) =>
      s.type === 'node'
        ? getPathNodeLabel(s.data)
        : `[${getPathEdgeLabel(s.data)}]`,
    )
    .join(' → ');
  return { nodeCount, edgeCount, startName, endName, summary };
}

/** 计算某条连线相对于给定节点的另一端节点键；不相邻时返回 null */
export function getPathEdgeOtherEnd(
  edge: unknown,
  nodeKey: string,
): string | null {
  const d = edge as { source?: string; target?: string } | null;
  const src = String(d?.source ?? '');
  const tgt = String(d?.target ?? '');
  if (src === nodeKey) return tgt;
  if (tgt === nodeKey) return src;
  return null;
}

/**
 * 若链路中所有关系均为「反向」，则将整条链路翻转为正向。
 * 方向由「边的 source 是否等于其前一个节点」推导得出，故只需反转数组顺序。
 * 单节点与方向混合的链路一律原样返回。
 */
export function normalizePathDirection(path: PathStep[]): PathStep[] {
  if (!path.some((s) => s.type === 'edge')) return path;
  const allReverse = path.every((step, idx) => {
    if (step.type !== 'edge') return true;
    const prevKey = getPathNodeKey(path[idx - 1]?.data);
    const d = step.data as { source?: string };
    return String(d?.source ?? '') !== prevKey;
  });
  if (!allReverse) return path;
  return path.slice().reverse();
}

/** 邻接表条目：edge 为图谱原始连线数据，neighbor 为另一端节点键 */
export interface AdjacencyEntry {
  edge: GraphLinkItem;
  neighbor: string;
}

/**
 * 搜索两节点间所有简单路径（DFS + 深度限制 + 结果数量限制）。
 * excludedNodes / excludedEdges 为已在路径中的元素，防止搜索结果绕回已选部分。
 */
export function findAllPaths(
  adjMap: Map<string, AdjacencyEntry[]>,
  nodeDataMap: Map<string, GraphNodeItem>,
  startKey: string,
  endKey: string,
  maxDepth = 6,
  maxResults = 10,
  excludedNodes?: Set<string>,
  excludedEdges?: Set<string>,
): PathStep[][] {
  const results: PathStep[][] = [];
  const startNode = nodeDataMap.get(startKey);
  if (!startNode || !nodeDataMap.has(endKey)) return results;

  const visitedNodes = new Set<string>([startKey]);
  excludedNodes?.forEach((k) => visitedNodes.add(k));
  const visitedEdges = new Set<string>();
  excludedEdges?.forEach((k) => visitedEdges.add(k));
  // endKey 是搜索目标，即使在排除集中也必须允许到达
  visitedNodes.delete(endKey);
  const stack: PathStep[] = [{ type: 'node', data: startNode }];

  function dfs(currentKey: string, depth: number) {
    if (results.length >= maxResults) return;
    if (currentKey === endKey && stack.length > 1) {
      results.push([...stack]);
      return;
    }
    if (depth >= maxDepth) return;

    const neighbors = adjMap.get(currentKey) || [];
    for (const { edge, neighbor } of neighbors) {
      if (visitedNodes.has(neighbor)) continue;
      const edgeKey = getPathEdgeKey(edge);
      if (visitedEdges.has(edgeKey)) continue;

      const neighborNode = nodeDataMap.get(neighbor);
      if (!neighborNode) continue;

      visitedNodes.add(neighbor);
      visitedEdges.add(edgeKey);
      stack.push({ type: 'edge', data: edge });
      stack.push({ type: 'node', data: neighborNode });

      dfs(neighbor, depth + 1);

      stack.pop();
      stack.pop();
      visitedNodes.delete(neighbor);
      visitedEdges.delete(edgeKey);
    }
  }

  dfs(startKey, 0);
  return results;
}
