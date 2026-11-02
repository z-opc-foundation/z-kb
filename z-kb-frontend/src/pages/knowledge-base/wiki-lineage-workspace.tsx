import Icon from '@/components/icon';
import { ConceptRecord, listConceptsByKb } from '@/services/concept';
import {
  getWikiLineage,
  listWikiPages,
  WikiLineageRecord,
  WikiPageRecord,
} from '@/services/wiki';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import ConceptDetailModal from './components/concept-detail-modal';

interface Props {
  kbId: string;
  initialWikiId?: string;
  focusConceptId?: string;
  onOpenMaterial?: (materialId: string) => void;
  onCountChange?: (count: number) => void;
}

type NodeKind = 'MATERIAL' | 'CONCEPT' | 'WIKI' | 'GRAPH';

const NETWORK_WIDTH = 640;
const NETWORK_HEIGHT = 600;
/** 每个节点期望占的像素面积，用来推导节点半径与期望间距 */
const NODE_AREA = 2000;

const TYPE_META: Record<
  NodeKind,
  { label: string; icon: string; color: string }
> = {
  MATERIAL: { label: '资料', icon: 'file-text', color: '#1f8bff' },
  CONCEPT: { label: '概念', icon: 'tag', color: '#f08a24' },
  WIKI: { label: 'Wiki', icon: 'book', color: '#0e9f6e' },
  GRAPH: { label: '图谱节点', icon: 'share', color: '#8a94a6' },
};

/** 固定元类型：资料 / 概念 / Wiki / 其余图谱节点 */
const KIND_ORDER: NodeKind[] = ['MATERIAL', 'CONCEPT', 'WIKI', 'GRAPH'];
const KIND_ANCHOR: Record<NodeKind, number> = {
  MATERIAL: 0.22,
  CONCEPT: 0.5,
  WIKI: 0.78,
  GRAPH: 0.5,
};

function kindMeta(nodeType: string) {
  return TYPE_META[nodeType as NodeKind];
}

function nodeRadius(kind: NodeKind): number {
  if (kind === 'WIKI') {
    return 20;
  }
  if (kind === 'MATERIAL') {
    return 17;
  }
  if (kind === 'CONCEPT') {
    return 14;
  }
  return 10;
}

/** 按「每个节点能分到多少画布面积」定半径，画布窄或节点多时自动收小 */
function densityScale(count: number, area: number): number {
  const perNode = area / Math.max(1, count);
  return Math.max(0.3, Math.min(1, Math.sqrt(perNode / NODE_AREA)));
}

interface NetworkNode {
  nodeId: string;
  kind: NodeKind;
}

interface NetworkLink {
  fromNodeId: string;
  toNodeId: string;
}

const LAYOUT_ITERATIONS = 130;
const RELAX_PASSES = 16;
const LAYOUT_CELL = 40;
const LAYOUT_CACHE_MAX = 6;
const layoutCache = new Map<string, Map<string, { x: number; y: number }>>();

/** 结构签名：同样一批节点和边只算一次布局，切页签回来直接用缓存 */
function layoutKey(nodes: NetworkNode[], links: NetworkLink[]): string {
  let hash = 2166136261;
  for (let index = 0; index < nodes.length; index += 1) {
    const id = nodes[index].nodeId;
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= KIND_ORDER.indexOf(nodes[index].kind);
    hash = Math.imul(hash, 16777619);
  }
  for (let index = 0; index < links.length; index += 1) {
    const { fromNodeId, toNodeId } = links[index];
    for (let i = 0; i < fromNodeId.length; i += 1) {
      hash ^= fromNodeId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    for (let i = 0; i < toNodeId.length; i += 1) {
      hash ^= toNodeId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${nodes.length}:${links.length}:${(hash >>> 0).toString(36)}`;
}

function nodeRadii(
  nodes: NetworkNode[],
  degrees: Int32Array,
  area: number,
): Float64Array {
  const density = densityScale(nodes.length, area);
  const radii = new Float64Array(nodes.length);
  for (let index = 0; index < nodes.length; index += 1) {
    const growth = 1 + Math.min(0.45, Math.log1p(degrees[index]) * 0.12);
    radii[index] = nodeRadius(nodes[index].kind) * density * growth;
  }
  return radii;
}

/**
 * 确定性布局：黄金角铺满画布 → Fruchterman-Reingold 力模型（全局排斥 + 边吸引 + 类型锚点）
 * → 网格邻域去重叠。
 * 全对排斥保持 620 个节点仍然铺得开，但用 Float64Array + Math.sqrt + 扁平 pairs
 * 把 240 轮 4600 万次距离计算压到 130 轮约 60ms；末端的网格 relax 只需处理邻近对，
 * 把半径重叠再压掉一层。同签名结果进 LRU，切回页签不再重算。
 */
function layoutNetwork(
  nodes: NetworkNode[],
  links: NetworkLink[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (!nodes.length) {
    return result;
  }
  const key = `${width}x${height}|${layoutKey(nodes, links)}`;
  const cached = layoutCache.get(key);
  if (cached) {
    layoutCache.delete(key);
    layoutCache.set(key, cached);
    return cached;
  }

  const total = nodes.length;
  const padX = 30;
  const padY = 28;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const xs = new Float64Array(total);
  const ys = new Float64Array(total);

  const goldenAngle = 2.399963229728653;
  const seedRadius = Math.min(innerW, innerH) * 0.55;
  for (let index = 0; index < total; index += 1) {
    const radius = seedRadius * Math.sqrt((index + 0.5) / total);
    const angle = index * goldenAngle;
    xs[index] = radius * Math.cos(angle);
    ys[index] = radius * Math.sin(angle);
  }

  const indexOf = new Map<string, number>();
  nodes.forEach((node, index) => indexOf.set(node.nodeId, index));
  const pairs: number[] = [];
  links.forEach((link) => {
    const from = indexOf.get(link.fromNodeId);
    const to = indexOf.get(link.toNodeId);
    if (from === undefined || to === undefined || from === to) {
      return;
    }
    pairs.push(from, to);
  });

  const degrees = new Int32Array(total);
  for (let p = 0; p < pairs.length; p += 2) {
    degrees[pairs[p]] += 1;
    degrees[pairs[p + 1]] += 1;
  }
  const radii = nodeRadii(nodes, degrees, innerW * innerH);

  // 右上角图例面板：宽度按 200 算，高度按图例条数估 170
  const guardLeft = width - 208;
  const guardBottom = Math.min(height - 40, 176);
  const clampPoint = (index: number) => {
    const radius = radii[index];
    let x = Math.min(width - 22, Math.max(22, xs[index]));
    let y = Math.min(height - 20, Math.max(20, ys[index]));
    if (x > guardLeft && y < guardBottom) {
      if (x - guardLeft < guardBottom - y) {
        x = guardLeft - radius - 2;
      } else {
        y = guardBottom + radius + 2;
      }
    }
    xs[index] = x;
    ys[index] = y;
  };

  const area = innerW * innerH;
  const k = Math.min(160, Math.max(40, Math.sqrt(area / total)));
  const kk = k * k;
  const dxs = new Float64Array(total);
  const dys = new Float64Array(total);
  let temp = Math.max(width, height) / 7;
  const decay = Math.pow(0.6 / temp, 1 / LAYOUT_ITERATIONS);
  const gravity = 0.15;

  // 先自由扩散（不贴边夹取），四种力平衡后得到一个大致均匀的团，再整体缩放进画布。
  // 早期版本每轮都夹边，节点被墙推着堆在四条边上，中间空成一个方框。
  for (let step = 0; step < LAYOUT_ITERATIONS; step += 1) {
    dxs.fill(0);
    dys.fill(0);

    for (let i = 0; i < total; i += 1) {
      const xi = xs[i];
      const yi = ys[i];
      let ax = 0;
      let ay = 0;
      for (let j = i + 1; j < total; j += 1) {
        const dx = xi - xs[j];
        const dy = yi - ys[j];
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = kk / dist / dist;
        ax += dx * f;
        ay += dy * f;
        dxs[j] -= dx * f;
        dys[j] -= dy * f;
      }
      dxs[i] += ax;
      dys[i] += ay;
    }

    for (let p = 0; p < pairs.length; p += 2) {
      const from = pairs[p];
      const to = pairs[p + 1];
      const dx = xs[from] - xs[to];
      const dy = ys[from] - ys[to];
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = dist / k;
      dxs[from] -= dx * f;
      dys[from] -= dy * f;
      dxs[to] += dx * f;
      dys[to] += dy * f;
    }

    for (let index = 0; index < total; index += 1) {
      const fx = dxs[index] - xs[index] * gravity;
      const fy = dys[index] - ys[index] * gravity;
      const dist = Math.sqrt(fx * fx + fy * fy);
      if (dist < 0.01) {
        continue;
      }
      const move = Math.min(dist, temp);
      xs[index] += (fx / dist) * move;
      ys[index] += (fy / dist) * move;
    }

    temp *= decay;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < total; index += 1) {
    minX = Math.min(minX, xs[index]);
    maxX = Math.max(maxX, xs[index]);
    minY = Math.min(minY, ys[index]);
    maxY = Math.max(maxY, ys[index]);
  }
  const scaleX = (width - padX * 2) / Math.max(1, maxX - minX);
  const scaleY = (height - padY * 2) / Math.max(1, maxY - minY);
  for (let index = 0; index < total; index += 1) {
    xs[index] = padX + (xs[index] - minX) * scaleX;
    ys[index] = padY + (ys[index] - minY) * scaleY;
  }

  // 缩放到画布后按类型轻微归拢：资料偏左、Wiki 偏右，概念居中
  for (let index = 0; index < total; index += 1) {
    const anchorX = padX + innerW * KIND_ANCHOR[nodes[index].kind];
    xs[index] += (anchorX - xs[index]) * 0.15;
  }

  const cols = Math.ceil(width / LAYOUT_CELL);
  const rows = Math.ceil(height / LAYOUT_CELL);
  const heads = new Int32Array(cols * rows);
  const nexts = new Int32Array(total);

  for (let pass = 0; pass < RELAX_PASSES; pass += 1) {
    heads.fill(-1);
    for (let index = 0; index < total; index += 1) {
      const cellX = Math.min(
        cols - 1,
        Math.max(0, Math.floor(xs[index] / LAYOUT_CELL)),
      );
      const cellY = Math.min(
        rows - 1,
        Math.max(0, Math.floor(ys[index] / LAYOUT_CELL)),
      );
      const slot = cellY * cols + cellX;
      nexts[index] = heads[slot];
      heads[slot] = index;
    }

    for (let index = 0; index < total; index += 1) {
      const cellX = Math.min(
        cols - 1,
        Math.max(0, Math.floor(xs[index] / LAYOUT_CELL)),
      );
      const cellY = Math.min(
        rows - 1,
        Math.max(0, Math.floor(ys[index] / LAYOUT_CELL)),
      );
      for (let oy = cellY - 2; oy <= cellY + 2; oy += 1) {
        if (oy < 0 || oy >= rows) {
          continue;
        }
        for (let ox = cellX - 2; ox <= cellX + 2; ox += 1) {
          if (ox < 0 || ox >= cols) {
            continue;
          }
          for (let other = heads[oy * cols + ox]; other !== -1; other = nexts[other]) {
            if (other <= index) {
              continue;
            }
            const dx = xs[other] - xs[index];
            const dy = ys[other] - ys[index];
            let dist = Math.sqrt(dx * dx + dy * dy);
            const minGap = (radii[index] + radii[other]) * 1.05;
            if (dist >= minGap) {
              continue;
            }
            if (dist < 0.001) {
              dist = 0.001;
            }
            const shift = (minGap - dist) * 0.45;
            const ux = dist < 0.002 ? 1 : dx / dist;
            const uy = dist < 0.002 ? 0 : dy / dist;
            xs[index] -= ux * shift;
            ys[index] -= uy * shift;
            xs[other] += ux * shift;
            ys[other] += uy * shift;
          }
        }
      }
    }

    for (let index = 0; index < total; index += 1) {
      clampPoint(index);
    }
  }

  nodes.forEach((node, index) => {
    result.set(node.nodeId, {
      x: Math.round(xs[index] * 10) / 10,
      y: Math.round(ys[index] * 10) / 10,
    });
  });

  layoutCache.set(key, result);
  if (layoutCache.size > LAYOUT_CACHE_MAX) {
    const oldest = layoutCache.keys().next().value;
    if (oldest !== undefined) {
      layoutCache.delete(oldest);
    }
  }
  return result;
}

function shortLabel(label: string, size = 16): string {
  if (!label) {
    return '未命名';
  }
  return label.length > size ? `${label.slice(0, size)}…` : label;
}

function conceptStatusMeta(status: string) {
  if (status === 'CONFIRMED') {
    return { label: '已确认', tag: 'green' };
  }
  if (status === 'EMERGING') {
    return { label: '涌现中', tag: 'amber' };
  }
  return { label: status || '未知', tag: 'gray' };
}

export default function WikiLineageWorkspace({
  kbId,
  initialWikiId,
  focusConceptId,
  onOpenMaterial,
  onCountChange,
}: Props) {
  const [scope, setScope] = useState<'kb' | 'wiki'>(
    initialWikiId ? 'wiki' : 'kb',
  );
  const [wikiId, setWikiId] = useState(initialWikiId || '');
  const [pages, setPages] = useState<WikiPageRecord[]>([]);
  const [lineage, setLineage] = useState<WikiLineageRecord | null>(null);
  const [concepts, setConcepts] = useState<ConceptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState('');
  const [detailConceptId, setDetailConceptId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [kinds, setKinds] = useState<Record<NodeKind, boolean>>({
    MATERIAL: true,
    CONCEPT: true,
    WIKI: true,
    GRAPH: true,
  });
  const [showArrows, setShowArrows] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const gRef = useRef<SVGGElement | null>(null);
  const rafRef = useRef(0);
  const wheelTimer = useRef(0);
  const focusHandled = useRef('');
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: NETWORK_WIDTH,
    height: NETWORK_HEIGHT,
  });
  const canvasObserver = useRef<ResizeObserver | null>(null);
  const setCanvasNode = useCallback((node: HTMLDivElement | null) => {
    canvasObserver.current?.disconnect();
    canvasObserver.current = null;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(320, Math.round(rect.height));
      setCanvasSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(node);
    canvasObserver.current = observer;
  }, []);
  useEffect(() => () => canvasObserver.current?.disconnect(), []);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const loadPages = useCallback(async () => {
    const result = await listWikiPages(kbId, undefined, 100);
    if (result) {
      setPages(result);
    }
  }, [kbId]);

  const loadConcepts = useCallback(async () => {
    const result = await listConceptsByKb(kbId);
    if (result) {
      setConcepts(result);
    }
  }, [kbId]);

  const loadLineage = useCallback(async () => {
    setLoading(true);
    const result =
      scope === 'wiki' && wikiId
        ? await getWikiLineage({ wikiId })
        : await getWikiLineage({ kbId });
    setLoading(false);
    if (!result) {
      return;
    }
    setLineage(result);
    setSelectedNode(result.nodes[0]?.nodeId || '');
  }, [scope, wikiId, kbId]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  useEffect(() => {
    void loadConcepts();
  }, [loadConcepts]);

  useEffect(() => {
    if (scope === 'wiki' && !wikiId) {
      setLineage(null);
      setLoading(false);
      return;
    }
    void loadLineage();
  }, [scope, wikiId, loadLineage]);

  useEffect(() => {
    onCountChange?.(lineage?.nodes.length ?? 0);
  }, [lineage, onCountChange]);

  const conceptByGraphNode = useMemo(() => {
    const map = new Map<string, ConceptRecord>();
    concepts.forEach((item) => {
      if (item.graphNodeId) {
        map.set(item.graphNodeId, item);
      }
    });
    return map;
  }, [concepts]);

  const graphOnly = useCallback(
    (node: WikiLineageRecord['nodes'][number]) =>
      node.nodeType !== 'MATERIAL' &&
      node.nodeType !== 'WIKI' &&
      node.nodeType !== 'CONCEPT' &&
      !conceptByGraphNode.has(node.nodeId),
    [conceptByGraphNode],
  );

  const materials = useMemo(
    () => (lineage?.nodes || []).filter((node) => node.nodeType === 'MATERIAL'),
    [lineage],
  );
  const wikis = useMemo(
    () => (lineage?.nodes || []).filter((node) => node.nodeType === 'WIKI'),
    [lineage],
  );
  const conceptNodes = useMemo(
    () =>
      (lineage?.nodes || []).filter(
        (node) =>
          node.nodeType !== 'MATERIAL' &&
          node.nodeType !== 'WIKI' &&
          !graphOnly(node),
      ),
    [lineage, graphOnly],
  );
  const graphNodes = useMemo(
    () => (lineage?.nodes || []).filter((node) => graphOnly(node)),
    [lineage, graphOnly],
  );

  const filtered = useMemo(() => {
    const target = keyword.trim().toLowerCase();
    const nodes = lineage?.nodes || [];
    if (!target) {
      return nodes;
    }
    return nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(target) ||
        node.nodeId.toLowerCase().includes(target) ||
        (kindMeta(node.nodeType)?.label || node.nodeType)
          .toLowerCase()
          .includes(target),
    );
  }, [lineage, keyword]);

  const kindOf = useCallback(
    (node: WikiLineageRecord['nodes'][number]): NodeKind => {
      if (node.nodeType === 'WIKI') {
        return 'WIKI';
      }
      if (node.nodeType === 'MATERIAL') {
        return 'MATERIAL';
      }
      if (node.nodeType === 'CONCEPT' || conceptByGraphNode.has(node.nodeId)) {
        return 'CONCEPT';
      }
      return 'GRAPH';
    },
    [conceptByGraphNode],
  );

  const kindByNodeId = useMemo(() => {
    const map = new Map<string, NodeKind>();
    (lineage?.nodes || []).forEach((node) =>
      map.set(node.nodeId, kindOf(node)),
    );
    return map;
  }, [lineage, kindOf]);

  const kindCounts = useMemo(() => {
    const counts: Record<NodeKind, number> = {
      MATERIAL: 0,
      CONCEPT: 0,
      WIKI: 0,
      GRAPH: 0,
    };
    kindByNodeId.forEach((kind) => {
      counts[kind] += 1;
    });
    return counts;
  }, [kindByNodeId]);

  const positions = useMemo(
    () =>
      layoutNetwork(
        (lineage?.nodes || []).map((node) => ({
          nodeId: node.nodeId,
          kind: kindByNodeId.get(node.nodeId) || 'GRAPH',
        })),
        lineage?.edges || [],
        canvasSize.width,
        canvasSize.height,
      ),
    [lineage, kindByNodeId, canvasSize],
  );

  const degreeByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    (lineage?.edges || []).forEach((edge) => {
      map.set(edge.fromNodeId, (map.get(edge.fromNodeId) || 0) + 1);
      map.set(edge.toNodeId, (map.get(edge.toNodeId) || 0) + 1);
    });
    return map;
  }, [lineage]);

  const radiusByNodeId = useMemo(() => {
    const nodes = lineage?.nodes || [];
    const density = densityScale(
      nodes.length,
      canvasSize.width * canvasSize.height,
    );
    const map = new Map<string, number>();
    nodes.forEach((node) => {
      const kind = kindByNodeId.get(node.nodeId) || 'GRAPH';
      const degree = degreeByNodeId.get(node.nodeId) || 0;
      map.set(
        node.nodeId,
        nodeRadius(kind) * density * (1 + Math.min(0.45, Math.log1p(degree) * 0.12)),
      );
    });
    return map;
  }, [lineage, kindByNodeId, degreeByNodeId, canvasSize]);

  const visibleNodeIds = useMemo(() => {
    const set = new Set<string>();
    kindByNodeId.forEach((kind, nodeId) => {
      if (kinds[kind]) {
        set.add(nodeId);
      }
    });
    return set;
  }, [kindByNodeId, kinds]);

  const matchedNodeIds = useMemo(() => {
    if (!keyword.trim()) {
      return null;
    }
    return new Set(filtered.map((node) => node.nodeId));
  }, [filtered, keyword]);

  /** 选中/搜索时只保留焦点附近的节点，其余压暗，避免一团糊 */
  const emphasisIds = useMemo(() => {
    if (matchedNodeIds) {
      return matchedNodeIds;
    }
    if (!selectedNode) {
      return null;
    }
    const set = new Set<string>([selectedNode]);
    (lineage?.edges || []).forEach((edge) => {
      if (edge.fromNodeId === selectedNode) {
        set.add(edge.toNodeId);
      }
      if (edge.toNodeId === selectedNode) {
        set.add(edge.fromNodeId);
      }
    });
    return set;
  }, [matchedNodeIds, selectedNode, lineage]);

  /**
   * 标签分级：默认只画选中节点、邻居和度数最高的十几个；
   * 放大后逐级放开，避免 620 个标签叠在一起看不清、也拖慢渲染。
   */
  const labelNodeIds = useMemo(() => {
    const nodes = lineage?.nodes || [];
    const set = new Set<string>();
    if (!nodes.length) {
      return set;
    }
    if (selectedNode) {
      set.add(selectedNode);
      (lineage?.edges || []).forEach((edge) => {
        if (edge.fromNodeId === selectedNode) {
          set.add(edge.toNodeId);
        }
        if (edge.toNodeId === selectedNode) {
          set.add(edge.fromNodeId);
        }
      });
    }
    matchedNodeIds?.forEach((nodeId) => set.add(nodeId));
    const cap = zoomLevel >= 3 ? nodes.length : zoomLevel === 2 ? 90 : 18;
    [...nodes]
      .sort(
        (a, b) =>
          (degreeByNodeId.get(b.nodeId) || 0) - (degreeByNodeId.get(a.nodeId) || 0),
      )
      .slice(0, cap)
      .forEach((node) => set.add(node.nodeId));
    return set;
  }, [lineage, selectedNode, matchedNodeIds, zoomLevel, degreeByNodeId]);

  const applyView = useCallback(() => {
    const group = gRef.current;
    if (!group) {
      return;
    }
    const { x, y, scale } = viewRef.current;
    group.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
  }, []);

  const scheduleApply = useCallback(() => {
    if (rafRef.current) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      applyView();
    });
  }, [applyView]);

  const commitView = useCallback(() => {
    const scale = viewRef.current.scale;
    const next = scale >= 2.1 ? 3 : scale >= 1.45 ? 2 : 1;
    setZoomLevel((prev) => (prev === next ? prev : next));
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { scale: 1, x: 0, y: 0 };
    setZoomLevel(1);
    applyView();
  }, [applyView]);

  useEffect(() => {
    resetView();
  }, [scope, wikiId, resetView]);

  useEffect(
    () => () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.clearTimeout(wheelTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!svgNode) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svgNode.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const px = ((event.clientX - rect.left) / rect.width) * canvasSize.width;
      const py = ((event.clientY - rect.top) / rect.height) * canvasSize.height;
      const prev = viewRef.current;
      const next = Math.min(
        3,
        Math.max(0.5, prev.scale * (event.deltaY < 0 ? 1.12 : 0.89)),
      );
      const factor = next / prev.scale;
      viewRef.current = {
        scale: next,
        x: px - (px - prev.x) * factor,
        y: py - (py - prev.y) * factor,
      };
      scheduleApply();
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(commitView, 140);
    };
    svgNode.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svgNode.removeEventListener('wheel', handleWheel);
      window.clearTimeout(wheelTimer.current);
    };
  }, [svgNode, scheduleApply, commitView, canvasSize]);

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: viewRef.current.x,
      baseY: viewRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = rect.width ? canvasSize.width / rect.width : 1;
    viewRef.current = {
      ...viewRef.current,
      x: drag.baseX + (event.clientX - drag.startX) * factor,
      y: drag.baseY + (event.clientY - drag.startY) * factor,
    };
    scheduleApply();
  };

  const endPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    commitView();
  };

  const selected = (lineage?.nodes || []).find(
    (node) => node.nodeId === selectedNode,
  );
  const selectedConcept = selected
    ? conceptByGraphNode.get(selected.nodeId)
    : undefined;
  const selectedEdges = (lineage?.edges || []).filter(
    (edge) =>
      edge.fromNodeId === selectedNode || edge.toNodeId === selectedNode,
  );

  const nodeLabel = (nodeId: string) =>
    (lineage?.nodes || []).find((node) => node.nodeId === nodeId)?.label ||
    nodeId;

  const empty = !loading && (!lineage || !lineage.nodes.length);

  useEffect(() => {
    if (!focusConceptId || loading || focusHandled.current === focusConceptId) {
      return;
    }
    const concept = concepts.find((item) => item.conceptId === focusConceptId);
    if (!concept) {
      return;
    }
    focusHandled.current = focusConceptId;
    const node = (lineage?.nodes || []).find(
      (item) => item.nodeId === concept.graphNodeId,
    );
    if (node) {
      setSelectedNode(node.nodeId);
    } else {
      setDetailConceptId(concept.conceptId);
    }
  }, [focusConceptId, loading, concepts, lineage]);

  const leftTree = (
    <section className="panel wiki-left">
      <div className="panel-head">
        <h3>
          <Icon name="git-branch" size={15} />
          节点
        </h3>
        <span className="hint">{lineage?.nodes.length ?? 0}</span>
      </div>
      <div className="panel-body" style={{ paddingBottom: 8 }}>
        <div className="input-icon">
          <span className="ic">
            <Icon name="search" size={13} />
          </span>
          <input
            className="input"
            placeholder="搜索节点名、类型或标识"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="搜索图谱节点"
          />
        </div>
      </div>
      <div className="tree">
        {(
          [
            ['MATERIAL', materials],
            ['CONCEPT', conceptNodes],
            ['WIKI', wikis],
            ['GRAPH', graphNodes],
          ] as Array<[NodeKind, WikiLineageRecord['nodes']]>
        ).map(([type, nodes]) => {
          const meta = TYPE_META[type];
          const list = matchedNodeIds
            ? nodes.filter((node) => matchedNodeIds.has(node.nodeId))
            : nodes;
          if (keyword.trim() && !list.length) {
            return null;
          }
          if ((type === 'GRAPH' || type === 'CONCEPT') && !list.length) {
            return null;
          }
          const folded = collapsed[type] && !keyword.trim();
          return (
            <div key={type}>
              <div
                className="tree-item"
                style={{ fontWeight: 600 }}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }))
                }
              >
                <Icon
                  name={folded ? 'chevron-right' : 'chevron-down'}
                  size={13}
                />
                {meta.label}
                <span className="count">{list.length}</span>
              </div>
              {folded
                ? null
                : list.map((node) => (
                    <div
                      key={node.nodeId}
                      className={`tree-item ${selectedNode === node.nodeId ? 'active' : ''}`}
                      style={{ paddingLeft: 24 }}
                      onClick={() => setSelectedNode(node.nodeId)}
                    >
                      <Icon name={meta.icon} size={13} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {node.label}
                      </span>
                    </div>
                  ))}
            </div>
          );
        })}
        {loading ? (
          <div className="tree-add" style={{ cursor: 'default' }}>
            正在加载节点…
          </div>
        ) : null}
        {!loading && !filtered.length ? (
          <div className="tree-add" style={{ cursor: 'default' }}>
            {keyword.trim() ? '没有匹配节点' : '暂无节点'}
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        <span className="mono-sm">按节点类型分组 · 可折叠</span>
      </div>
    </section>
  );

  const toolbar = (
    <div className="table-toolbar">
      <div className="left">
        <div className="subtabs" style={{ marginBottom: 0 }}>
          <button
            className={`btn sm ${scope === 'kb' ? 'primary-soft' : 'ghost'}`}
            type="button"
            onClick={() => setScope('kb')}
          >
            <Icon name="layers" size={13} />
            库内全部
          </button>
          <button
            className={`btn sm ${scope === 'wiki' ? 'primary-soft' : 'ghost'}`}
            type="button"
            onClick={() => {
              setScope('wiki');
              if (!wikiId && pages[0]) {
                setWikiId(pages[0].wikiId);
              }
            }}
          >
            <Icon name="file-text" size={13} />
            单篇 Wiki
          </button>
        </div>
        {scope === 'wiki' ? (
          <select
            className="select"
            value={wikiId}
            onChange={(event) => setWikiId(event.target.value)}
            aria-label="选择 Wiki"
          >
            {!pages.length ? <option value="">暂无可选 Wiki</option> : null}
            {pages.map((page) => (
              <option key={page.wikiId} value={page.wikiId}>
                {page.title}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="btn-group">
        <span className="tag gray">只读图谱</span>
        <button
          className="btn xs ghost"
          type="button"
          onClick={() => void loadLineage()}
          disabled={loading}
        >
          刷新
        </button>
      </div>
    </div>
  );

  const stats = (
    <div className="wb-graph-stats">
      <div className="wb-graph-stat">
        <small>节点</small>
        <b>{lineage?.nodes.length ?? 0}</b>
      </div>
      <div className="wb-graph-stat">
        <small>资料</small>
        <b>{materials.length}</b>
      </div>
      <div className="wb-graph-stat">
        <small>概念</small>
        <b>{conceptNodes.length}</b>
      </div>
      <div className="wb-graph-stat">
        <small>Wiki</small>
        <b>{wikis.length}</b>
      </div>
      <div className="wb-graph-stat">
        <small>关系</small>
        <b>{lineage?.edges.length ?? 0}</b>
      </div>
      <div className="wb-graph-stat">
        <small>证据资料</small>
        <b>{lineage?.sourceCount ?? 0}</b>
      </div>
    </div>
  );

  const edgeElements = useMemo(() => {
    const elements: ReactNode[] = [];
    (lineage?.edges || []).forEach((edge, index) => {
      if (
        !visibleNodeIds.has(edge.fromNodeId) ||
        !visibleNodeIds.has(edge.toNodeId)
      ) {
        return;
      }
      const from = positions.get(edge.fromNodeId);
      const to = positions.get(edge.toNodeId);
      if (!from || !to) {
        return;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const startGap = (radiusByNodeId.get(edge.fromNodeId) || 8) + 2;
      const endGap =
        (radiusByNodeId.get(edge.toNodeId) || 8) + (showArrows ? 6 : 2);
      const active =
        edge.fromNodeId === selectedNode || edge.toNodeId === selectedNode;
      const dim = emphasisIds
        ? !(
            emphasisIds.has(edge.fromNodeId) && emphasisIds.has(edge.toNodeId)
          )
        : false;
      elements.push(
        <line
          key={`${edge.fromNodeId}-${edge.toNodeId}-${index}`}
          x1={from.x + (dx / dist) * startGap}
          y1={from.y + (dy / dist) * startGap}
          x2={to.x - (dx / dist) * endGap}
          y2={to.y - (dy / dist) * endGap}
          className={`wb-network-edge${active ? ' active' : ''}${dim ? ' dim' : ''}`}
          markerEnd={showArrows ? 'url(#lineage-arrow)' : undefined}
        />,
      );
    });
    return elements;
  }, [
    lineage,
    positions,
    visibleNodeIds,
    showArrows,
    selectedNode,
    radiusByNodeId,
    emphasisIds,
  ]);

  const nodeElements = useMemo(() => {
    const elements: ReactNode[] = [];
    (lineage?.nodes || []).forEach((node) => {
      if (!visibleNodeIds.has(node.nodeId)) {
        return;
      }
      const pos = positions.get(node.nodeId);
      if (!pos) {
        return;
      }
      const kind = kindByNodeId.get(node.nodeId) || 'GRAPH';
      const radius = radiusByNodeId.get(node.nodeId) || 6;
      const selected = selectedNode === node.nodeId;
      const dim = emphasisIds
        ? !emphasisIds.has(node.nodeId) && !selected
        : false;
      const flip = pos.x > NETWORK_WIDTH * 0.8;
      elements.push(
        <g
          key={node.nodeId}
          className={`wb-network-node${selected ? ' sel' : ''}${
            dim ? ' dim' : ''
          }`}
          onClick={() => setSelectedNode(node.nodeId)}
        >
          <title>{node.label}</title>
          <circle
            cx={pos.x}
            cy={pos.y}
            r={radius}
            fill={TYPE_META[kind]?.color || '#8a94a6'}
          />
          {labelNodeIds.has(node.nodeId) ? (
            <text
              x={flip ? pos.x - radius - 4 : pos.x + radius + 4}
              y={pos.y + 3.2}
              textAnchor={flip ? 'end' : 'start'}
              className={`wb-network-label${selected ? ' sel' : ''}`}
            >
              {shortLabel(node.label, 10)}
            </text>
          ) : null}
        </g>,
      );
    });
    return elements;
  }, [
    lineage,
    visibleNodeIds,
    positions,
    kindByNodeId,
    radiusByNodeId,
    emphasisIds,
    labelNodeIds,
    selectedNode,
  ]);

  const canvas = (
    <div className="graph-canvas wb-network-canvas" ref={setCanvasNode}>
      <svg
        ref={setSvgNode}
        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Wiki 图谱"
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <defs>
          <marker
            id="lineage-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9cbe0" />
          </marker>
        </defs>
        {/* 平移缩放由 applyView 直接写 transform：高频拖动不触发重渲染，这里只给初值 */}
        <g ref={gRef} className="wb-network-view" transform="translate(0 0) scale(1)">
          {edgeElements}
          {nodeElements}
        </g>
      </svg>
      <div className="wb-network-panel">
        <div className="wb-network-count">
          <b>{visibleNodeIds.size}</b> / {lineage?.nodes.length ?? 0} 个节点
        </div>
        <div className="wb-network-legend">
          {KIND_ORDER.map((kind) => {
            const count = kindCounts[kind];
            if (!count) {
              return null;
            }
            return (
              <button
                key={kind}
                type="button"
                className={`wb-network-legend-row${kinds[kind] ? '' : ' off'}`}
                aria-pressed={kinds[kind]}
                onClick={() =>
                  setKinds((prev) => ({ ...prev, [kind]: !prev[kind] }))
                }
              >
                <i style={{ background: TYPE_META[kind].color }}></i>
                {TYPE_META[kind].label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="wb-network-actions">
          <button type="button" onClick={resetView}>
            适应屏幕
          </button>
          <button type="button" onClick={() => setShowArrows((prev) => !prev)}>
            {showArrows ? '隐藏箭头' : '显示箭头'}
          </button>
        </div>
      </div>
      <p className="wb-graph-note">
        只读图谱：资料 → Wiki 为来源证据；概念节点由编译萃取涌现，不代表 Wiki 的下游或发布关系。
      </p>
    </div>
  );

  const selectedKind = !selected
    ? null
    : selected.nodeType === 'WIKI'
      ? 'WIKI'
      : selected.nodeType === 'MATERIAL'
        ? 'MATERIAL'
        : selectedConcept || selected.nodeType === 'CONCEPT'
          ? 'CONCEPT'
          : 'GRAPH';
  const selectedMeta = selectedKind ? TYPE_META[selectedKind] : null;

  const nodeDetail =
    selected && selectedMeta ? (
      <div className="wb-lineage-detail">
        <div className="panel-head" style={{ padding: '0 0 10px' }}>
          <h3>
            <Icon name={selectedMeta.icon} size={14} />
            {selected.label}
          </h3>
          <span
            className={`tag ${selectedKind === 'CONCEPT' ? 'green' : 'blue'}`}
          >
            {selectedMeta.label}
          </span>
        </div>
        {selectedConcept ? (
          <div className="mb-12">
            <div
              className="meta mb-8"
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
            >
              <span
                className={`tag ${conceptStatusMeta(selectedConcept.status).tag}`}
              >
                {conceptStatusMeta(selectedConcept.status).label}
              </span>
              <span className="tag blue">
                提及 {selectedConcept.mentionCount}
              </span>
              <span className="tag gray">
                来源资料 {selectedConcept.materialCount}
              </span>
            </div>
            {selectedConcept.definition ? (
              <p className="muted" style={{ lineHeight: 1.7 }}>
                {selectedConcept.definition}
              </p>
            ) : null}
            <button
              className="btn sm ghost mt-8"
              type="button"
              onClick={() => setDetailConceptId(selectedConcept.conceptId)}
            >
              <Icon name="external-link" size={13} />
              查看概念详情
            </button>
          </div>
        ) : null}
        <dl className="kv">
          <dt>节点标识</dt>
          <dd className="mono-sm">{selected.nodeId}</dd>
          <dt>引用对象</dt>
          <dd className="mono-sm">{selected.refId}</dd>
          <dt>关系数</dt>
          <dd>{selectedEdges.length}</dd>
        </dl>
        <div style={{ marginTop: 8 }}>
          {selectedEdges.map((edge, index) => (
            <div
              className="binding-row"
              key={`${edge.fromNodeId}-${edge.toNodeId}-${index}`}
            >
              <span className="ic">
                <Icon name="git-branch" size={14} />
              </span>
              <div className="copy">
                <b>{nodeLabel(edge.fromNodeId)}</b>
                <small>
                  {edge.relation} → {nodeLabel(edge.toNodeId)}
                </small>
              </div>
            </div>
          ))}
        </div>
        {selected.nodeType === 'MATERIAL' && onOpenMaterial ? (
          <button
            className="btn sm ghost mt-16"
            type="button"
            onClick={() => onOpenMaterial(selected.refId)}
          >
            <Icon name="external-link" size={13} />
            回到资料详情
          </button>
        ) : null}
      </div>
    ) : null;

  const middle = (
    <section className="panel">
      {toolbar}
      <div className="panel-body">
        {loading ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="git-branch" size={22} />
            </div>
            <b>正在加载图谱…</b>
            <p>只读取当前租户、当前知识库内的图谱关系。</p>
          </div>
        ) : empty ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="git-branch" size={22} />
            </div>
            <b>
              {scope === 'wiki'
                ? '这篇 Wiki 还没有来源证据'
                : '这个库还没有 Wiki 图谱'}
            </b>
            <p>
              先在 Wiki 视图生成 Wiki；生成后每篇 Wiki 会记录来源资料，
              并在图谱中挂上资料与概念节点。
            </p>
          </div>
        ) : (
          <div>
            {stats}
            {canvas}
            {nodeDetail}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      <div className="wiki-layout">
        {leftTree}
        {middle}
      </div>
      {detailConceptId ? (
        <ConceptDetailModal
          kbId={kbId}
          conceptId={detailConceptId}
          onClose={() => setDetailConceptId('')}
          onOpenMaterial={
            onOpenMaterial
              ? (materialId) => {
                  setDetailConceptId('');
                  onOpenMaterial(materialId);
                }
              : undefined
          }
        />
      ) : null}
    </>
  );
}
