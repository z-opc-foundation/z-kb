/**
 * G6 v5 图谱样式与配置模块
 *
 * 自 galaxy-meta src/pages/brain/graph/styles.ts 平移（含力导向布局与
 * G6 v5 坑位修复），默认节点配色对齐 fe-future-brain 品牌蓝。
 */

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import type { G6Edge, G6Node } from './types';

// ─── 路径高亮配色（从 ontology.tsx:1666-1674 迁移） ───
export const PATH_HL_COLOR = '#3d7dd4';
export const PATH_HL_LIGHT = '#89b4e8';
export const PATH_HL_DEEP = '#1e4f8f';
export const PATH_DIM_NODE_COLOR = '#94a3b8';
export const PATH_DIM_NODE_BORDER = '#64748b';
export const PATH_DIM_EDGE_COLOR = '#94a3b8';
export const PATH_DIM_LABEL_COLOR = '#64748b';

// ─── 节点默认配色（对齐 fe-future-brain 品牌蓝 #1F8BFF） ───
export const NODE_FILL = '#1F8BFF';
export const NODE_STROKE = '#0F6FDB';
export const NODE_SHADOW_COLOR = 'rgba(31, 139, 255, 0.25)';
export const NODE_SIZE = 52;
export const NODE_LABEL_FILL = '#fff';
export const NODE_LABEL_FONT_SIZE = 11;

// ─── 分类配色：按 categoryCode 分配不同颜色 ───
// 未归类对象所使用的虚拟分类编码（与 ontology.tsx 一致）
export const UNCATEGORIZED_CAT_CODE = '__uncategorized__';

/** 分类调色板：每个分类按出现顺序循环取色，fill 为主色，stroke 为加深边框色 */
const CATEGORY_PALETTE: Array<{ fill: string; stroke: string }> = [
  { fill: '#722ed1', stroke: '#531cd3' }, // 紫
  { fill: '#1890ff', stroke: '#006cd4' }, // 蓝
  { fill: '#13c2c2', stroke: '#08979b' }, // 青
  { fill: '#52c41a', stroke: '#389e0d' }, // 绿
  { fill: '#fa8c16', stroke: '#d4670c' }, // 橙
  { fill: '#f5222d', stroke: '#cf1717' }, // 红
  { fill: '#eb2f96', stroke: '#c41d78' }, // 粉
  { fill: '#faad14', stroke: '#d48806' }, // 金
  { fill: '#2f54eb', stroke: '#1d39c4' }, // 极客蓝
  { fill: '#a0d911', stroke: '#7cb305' }, // 青柠
];

/** 未分类节点的配色：沿用原始默认蓝色，与其他分类的调色板颜色形成区分 */
const UNCATEGORIZED_PALETTE = { fill: NODE_FILL, stroke: NODE_STROKE };

/** hex → rgba 字符串（用于 shadowColor） */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 分类颜色条目 */
export interface CategoryColor {
  fill: string;
  stroke: string;
  shadowColor: string;
}

/**
 * 按 tagCategories 顺序构建 categoryCode → 颜色映射。
 *
 * - 各分类按 sortOrder 循环取调色板颜色，保证同一分类在不同渲染轮次颜色稳定；
 * - 未分类（categoryCode 为空 / UNCATEGORIZED_CAT_CODE）沿用原始默认蓝色；
 * - 传入 null 时返回空 Map，getNodeStyle 会回退到默认蓝色。
 */
export function buildCategoryColorMap(
  categories: Array<{ categoryCode: string; sortOrder?: number }>,
): Map<string, CategoryColor> {
  const map = new Map<string, CategoryColor>();
  // 按 sortOrder 排序后分配颜色，保证分类管理顺序变化时颜色跟随调整
  const sorted = [...categories].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  sorted.forEach((cat, i) => {
    const code = cat.categoryCode || UNCATEGORIZED_CAT_CODE;
    if (map.has(code)) return;
    const palette =
      code === UNCATEGORIZED_CAT_CODE
        ? UNCATEGORIZED_PALETTE
        : CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    map.set(code, {
      fill: palette.fill,
      stroke: palette.stroke,
      shadowColor: hexToRgba(palette.fill, 0.25),
    });
  });
  // 确保未分类始终有条目（即使 tagCategories 中没有显式的空分类）
  if (!map.has(UNCATEGORIZED_CAT_CODE)) {
    map.set(UNCATEGORIZED_CAT_CODE, {
      fill: UNCATEGORIZED_PALETTE.fill,
      stroke: UNCATEGORIZED_PALETTE.stroke,
      shadowColor: hexToRgba(UNCATEGORIZED_PALETTE.fill, 0.25),
    });
  }
  return map;
}

// ─── 边默认配色（ontology.tsx:4760 link 级 #f59e0b, 5193-5197 series 级 #b0c4de） ───
export const EDGE_STROKE = '#f59e0b';
export const EDGE_WIDTH = 2;
export const EDGE_LABEL_COLOR = '#64748b';
export const EDGE_LABEL_FONT_SIZE = 10;

// ─── emphasis 配色（ontology.tsx:5199-5219） ───
export const EMPHASIS_NODE_FILL = '#2563eb';
export const EMPHASIS_NODE_STROKE = '#ffffff';
export const EMPHASIS_EDGE_STROKE = '#f59e0b';

/**
 * 节点默认样式映射
 * 复刻 ontology.tsx:4702-4738 的 ECharts itemStyle + label rich text
 * G6 v5 用 fill/stroke/lineWidth/shadowBlur 替代 itemStyle.color/borderColor/shadowBlur
 * 实例数用 label 多行文本（\n）显示在节点名下方
 */
export function getNodeStyle(
  node: G6Node,
  instanceCount?: number,
  categoryColor?: CategoryColor,
): Record<string, any> {
  const name = node.data.name || node.data.code || node.data.id || '';
  // 多行 label：第一行节点名，第二行实例数（参考图中节点内布局）
  const labelText = instanceCount != null ? `${name}\n${instanceCount}` : name;
  // 有分类颜色时用分类色，否则回退到默认蓝色
  const fill = categoryColor?.fill ?? NODE_FILL;
  const stroke = categoryColor?.stroke ?? NODE_STROKE;
  const shadowColor = categoryColor?.shadowColor ?? NODE_SHADOW_COLOR;
  return {
    // ─── 对应 ECharts itemStyle ───
    fill,
    stroke,
    lineWidth: 1,
    shadowColor,
    shadowBlur: 8,
    // ─── 对应 ECharts symbolSize ───
    size: NODE_SIZE,
    // 节点渲染在边之上，避免边线覆盖节点
    zIndex: 10,
    // ─── 对应 ECharts label ───
    labelText,
    labelFill: NODE_LABEL_FILL,
    labelFontSize: NODE_LABEL_FONT_SIZE,
    labelFontWeight: 'bold',
    // G6 v5 用 labelPlacement 控制标签位置（非 labelPosition），默认 'bottom'
    labelPlacement: 'center',
  };
}

/**
 * 边默认样式映射
 * 复刻 ontology.tsx:4760（link 级 lineStyle.color #f59e0b, width 2）
 * 和 5193-5197（series 级 lineStyle curveness 0.15, opacity 0.7）
 * 边 label 沿连线方向自动旋转，多行显示关系名 + 实例数
 */
export function getEdgeStyle(
  edge: G6Edge,
  instanceCount?: number,
): Record<string, any> {
  const name = edge.data.displayName || '';
  // 多行 label：第一行关系名，第二行实例数（参考图中边上标签布局）
  const labelText = instanceCount != null ? `${name}\n${instanceCount}` : name;
  // 自关联边才显示箭头（体现实例间关系方向），其他边无箭头
  const isSelfAssoc = edge.data.isSelfAssoc;
  return {
    stroke: EDGE_STROKE,
    lineWidth: EDGE_WIDTH,
    opacity: 0.7,
    // 边渲染在节点之下
    zIndex: 1,
    ...(isSelfAssoc ? { endArrow: true, endArrowSize: 8 } : {}),
    // 边 label（对应 ECharts edgeLabel）
    labelText,
    labelFill: EDGE_LABEL_COLOR,
    labelFontSize: EDGE_LABEL_FONT_SIZE,
    labelFontWeight: 'bold',
    // 标签沿连线方向自动旋转（参考图中边上文字斜排）
    labelAutoRotate: true,
  };
}

// ─── G6 State 样式定义 ───
// 对应 ECharts emphasis + 路径高亮 + 双向高亮联动

/**
 * emphasis state（对应 ECharts emphasis itemStyle/lineStyle）
 * ontology.tsx:5199-5219
 */
export const STATE_STYLES: Record<string, Record<string, any>> = {
  // hover/选中 emphasis
  emphasis: {
    node: {
      fill: EMPHASIS_NODE_FILL,
      stroke: EMPHASIS_NODE_STROKE,
      lineWidth: 3,
      shadowColor: 'rgba(37, 99, 235, 0.55)',
      shadowBlur: 16,
    },
    edge: {
      stroke: EMPHASIS_EDGE_STROKE,
      lineWidth: 4,
      shadowColor: 'rgba(245, 158, 11, 0.45)',
      shadowBlur: 8,
    },
  },
  // 路径高亮节点（对应 PATH_HL_COLOR 等）
  pathHighlight: {
    node: {
      fill: PATH_HL_COLOR,
      stroke: PATH_HL_LIGHT,
      lineWidth: 2,
      shadowColor: 'rgba(61, 125, 212, 0.75)',
      shadowBlur: 20,
      labelFill: '#fff',
      labelFontWeight: 'bold',
    },
    edge: {
      stroke: PATH_HL_COLOR,
      lineWidth: 4,
      opacity: 1,
      shadowColor: 'rgba(61, 125, 212, 0.55)',
      shadowBlur: 12,
      labelFill: '#1e3a5f',
      labelFontWeight: 'bold',
    },
  },
  // 路径末尾节点（对应 PATH_HL_DEEP）
  pathLast: {
    node: {
      fill: PATH_HL_COLOR,
      stroke: PATH_HL_DEEP,
      lineWidth: 4,
      shadowColor: 'rgba(61, 125, 212, 0.75)',
      shadowBlur: 20,
      labelFill: '#fff',
      labelFontWeight: 'bold',
    },
    edge: {
      stroke: PATH_HL_DEEP,
      lineWidth: 4,
      opacity: 1,
      shadowColor: 'rgba(61, 125, 212, 0.55)',
      shadowBlur: 12,
      labelFill: '#1e3a5f',
      labelFontWeight: 'bold',
    },
  },
  // 路径弱化节点（对应 PATH_DIM_NODE_COLOR 等）
  pathDim: {
    node: {
      fill: PATH_DIM_NODE_COLOR,
      stroke: PATH_DIM_NODE_BORDER,
      lineWidth: 1,
      opacity: 1,
      labelFill: PATH_DIM_LABEL_COLOR,
    },
    edge: {
      stroke: PATH_DIM_EDGE_COLOR,
      lineWidth: 1,
      opacity: 0.9,
      labelFill: PATH_DIM_LABEL_COLOR,
    },
  },
};

/**
 * 力导向布局配置
 * ECharts force: { repulsion: 420, edgeLength: 150, gravity: 0.12, friction: 0.3 }
 * G6 v5 force layout 参数语义不同，需逐一校准
 *
 * 参数对照：
 *   ECharts repulsion(420)  → G6 nodeStrength(-420, 负值=排斥)
 *   ECharts edgeLength(150) → G6 linkDistance(150)
 *   ECharts gravity(0.12)   → G6 centerStrength(0.12)
 *   ECharts friction(0.3)   → G6 无直接对应，velocityDecay 近似
 */
export const FORCE_LAYOUT_CONFIG = {
  type: 'force' as const,
  linkDistance: 150,
  nodeStrength: -420,
  preventOverlap: true,
  nodeSize: NODE_SIZE,
  centerStrength: 0.12,
  // 禁用动画以避免 render() Promise 卡住
  animated: false,
};

/**
 * 查找连通分量：有关系的节点归为同一簇，无关系的节点各自独立。
 * 用 BFS 遍历邻接表，每个连通分重分配一个簇 ID。
 * 返回 Map<nodeId, clusterId>。
 */
function findClusters(d3Nodes: any[], d3Links: any[]): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  d3Nodes.forEach((n) => adjacency.set(n.id, new Set()));
  d3Links.forEach((l) => {
    const s = String(l.source);
    const t = String(l.target);
    adjacency.get(s)?.add(t);
    adjacency.get(t)?.add(s);
  });

  const clusterMap = new Map<string, number>();
  let clusterId = 0;
  d3Nodes.forEach((n) => {
    if (clusterMap.has(n.id)) return;
    const queue = [n.id];
    clusterMap.set(n.id, clusterId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      adjacency.get(curr)?.forEach((neighbor) => {
        if (!clusterMap.has(neighbor)) {
          clusterMap.set(neighbor, clusterId);
          queue.push(neighbor);
        }
      });
    }
    clusterId += 1;
  });
  return clusterMap;
}

/**
 * 为每个簇分配中心坐标：最大簇在画布中心，其余簇按大小递减分布在周围环形上。
 * 孤立节点（簇大小=1）位于最外圈，与有关系的簇形成视觉隔离。
 *
 * 全孤立场景（无任何边的图，如检索子图锦点全孤立）：所有簇 size=1，
 * 环形角度公式在 2/3 簇时恰好共线（angle π 与 2π≡0 同一水平线，
 * 节点排成一行且被斥力推出画布截断）——改为均匀环形分布，
 * 起角 -π/2（顶部）避免与坐标轴对称重叠。
 */
function getClusterCenters(
  clusterMap: Map<string, number>,
  d3Nodes: any[],
  width: number,
  height: number,
  spreadIsolated = false,
): Map<number, { x: number; y: number }> {
  const clusterSizes = new Map<number, number>();
  clusterMap.forEach((cid) => {
    clusterSizes.set(cid, (clusterSizes.get(cid) ?? 0) + 1);
  });
  // 按簇大小降序：大簇靠近中心，小簇和孤立节点在外围
  const sorted = Array.from(clusterSizes.keys()).sort(
    (a, b) => (clusterSizes.get(b) ?? 0) - (clusterSizes.get(a) ?? 0),
  );

  const cx = width / 2;
  const cy = height / 2;
  const centers = new Map<number, { x: number; y: number }>();

  if (sorted.length === 1) {
    centers.set(sorted[0], { x: cx, y: cy });
    return centers;
  }

  const isolated = sorted.filter((cid) => (clusterSizes.get(cid) ?? 0) === 1);
  const big = sorted.filter((cid) => (clusterSizes.get(cid) ?? 0) > 1);

  // 孤立节点网格铺开（spreadIsolated）：环形受周长限制，节点多时
  // 挤成一圈密行（实例子图 201 孤立实例实测）——改为网格均匀铺满画布。
  // 全孤立直接整幅网格；混合场景孤立多于 12 个才网格（少量孤立
  // 沿外环与主簇隔离更清晰，网格位置可能落进主簇聚集区被 collide 推挤）
  if (spreadIsolated && (big.length === 0 || isolated.length > 12)) {
    const pad = Math.min(width, height) * 0.08;
    const cols = Math.ceil(Math.sqrt(isolated.length));
    const rows = Math.ceil(isolated.length / cols);
    const cellW = (width - pad * 2) / cols;
    const cellH = (height - pad * 2) / rows;
    isolated.forEach((cid, i) => {
      centers.set(cid, {
        x: pad + ((i % cols) + 0.5) * cellW,
        y: pad + (Math.floor(i / cols) + 0.5) * cellH,
      });
    });
    if (big.length === 0) {
      return centers;
    }
  }

  // 全孤立且未启用网格（默认路径）：均匀环形，不再留中心簇 ——
  // 环形公式 (i/(n-1))*2π 在 n=2 时两点重叠在 angle=π，n=3 时共线，均退化
  const allIsolated = isolated.length === sorted.length;
  if (allIsolated) {
    const dist = Math.min(width, height) * 0.32;
    sorted.forEach((cid, i) => {
      const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
      centers.set(cid, {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      });
    });
    return centers;
  }

  // 最大簇在中心，其余沿环形分布
  // dist 系数 0.28：簇间留有足够间距，避免不同簇的节点与边互相穿插
  sorted.forEach((cid, i) => {
    if (centers.has(cid)) return;
    if (!centers.size) {
      centers.set(cid, { x: cx, y: cy });
    } else {
      const angle = (i / (sorted.length - 1)) * Math.PI * 2;
      const dist = Math.min(width, height) * 0.28;
      centers.set(cid, {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      });
    }
  });
  return centers;
}

/**
 * 预计算力导向布局位置
 *
 * G6 v5 animation:false 时 preLayout 同步失效（已完全移除 G6 内置 layout）。
 * 此函数在 setData 前用 d3-force 直接计算位置，将 x/y 写入节点 style。
 *
 * 布局策略：按连通分量分簇，每簇有独立中心点。
 * - 有关系的节点被 link 力拉紧在同一簇中心附近 → 紧凑聚簇
 * - 无关系的节点被 charge 排斥力推至各自簇中心 → 视觉隔离
 *
 * 参数（防重叠优化）：
 * - linkDistance: 140 (连线两端留足间距，使边不贴节点边缘走)
 * - nodeStrength: -450 (较强排斥力，主动推开重叠节点)
 * - clusterGravity: 0.10 (适度向心力，过强会压叠簇内节点)
 * - collideRadius: NODE_SIZE * 1.3 ≈ 68 (碰撞半径大于节点半径，
 *   在节点周围形成隔离带，既防节点重叠也给边留出穿行空间)
 * - iterations: 500 (增加迭代次数使布局收敛更充分)
 *
 * 自关联边（source===target）不参与力计算（节点不会拉扯自己）。
 *
 * 参数档位（options）：默认档按本体库大画布大节点（NODE_SIZE=52）校准；
 * 窄容器小节点图（如知识库 V3 副页检索子图，448×390 画布 + 24~30px
 * 节点）直接复用默认档会严重压叠（24 节点实测：最小间距 0、重叠 14/276
 * 对——collide 67.6 的隔离需求远超可用面积），应传紧凑档
 * （nodeSize=30 / linkDistance=95 / chargeStrength=-300，实测重叠降至 1 对）。
 */
export interface ForceLayoutOptions {
  /** 节点直径口径：collide 半径 = nodeSize*1.3，边界 padding = nodeSize*1.15。默认 NODE_SIZE(52)=本体库大节点 */
  nodeSize?: number;
  /** 链接力目标距离。默认 140 */
  linkDistance?: number;
  /** 斥力强度。默认 -450 */
  chargeStrength?: number;
  /** 孤立节点网格铺开（实例层：大量无关系实例挤环形密行时启用）。默认 false 沿环形 */
  spreadIsolated?: boolean;
}

export function computeForceLayout(
  data: import('./types').GraphData,
  width: number,
  height: number,
  options?: ForceLayoutOptions,
): void {
  const {
    nodeSize = NODE_SIZE,
    linkDistance = 140,
    chargeStrength = -450,
    spreadIsolated = false,
  } = options ?? {};
  const { nodes: g6Nodes, edges: g6Edges } = data;
  if (g6Nodes.length === 0) return;

  // d3-force 节点对象（需要独立于 G6 数据，因为 simulation 会修改 x/y）
  // 初始半径 0.14：稍宽的初始分布，配合更强的排斥力让节点自然散开
  const radius = Math.min(width, height) * 0.14;
  const d3Nodes = g6Nodes.map((n, i) => ({
    id: n.id,
    // 以圆形分布在容器中心附近，较小的初始半径确保紧凑布局
    x:
      width / 2 +
      Math.cos((i / Math.max(g6Nodes.length, 1)) * Math.PI * 2) * radius,
    y:
      height / 2 +
      Math.sin((i / Math.max(g6Nodes.length, 1)) * Math.PI * 2) * radius,
    vx: 0,
    vy: 0,
  }));

  // d3-force 边对象（排除自关联边，节点不会拉扯自己）
  const d3Links = g6Edges
    .filter((e) => e.source !== e.target)
    .map((e) => ({
      source: e.source,
      target: e.target,
    }));

  // 按连通分量分簇：有关系的节点归为同一簇，各自有独立中心
  const clusterMap = findClusters(d3Nodes, d3Links);
  const clusterCenters = getClusterCenters(
    clusterMap,
    d3Nodes,
    width,
    height,
    spreadIsolated,
  );

  // 创建仿真（stop() 后手动 tick，同步执行）
  // 分簇布局：forceX/forceY 按节点的簇中心取值，而非全局中心
  // 同簇节点被拉向同一中心 → 紧凑聚簇；不同簇节点中心不同 → 视觉隔离
  const simulation = forceSimulation(d3Nodes)
    .force(
      'link',
      forceLink(d3Links)
        .id((d: any) => d.id)
        .distance(linkDistance),
    )
    .force('charge', forceManyBody().strength(chargeStrength))
    .force(
      'x',
      forceX(
        (d: any) => clusterCenters.get(clusterMap.get(d.id)!)?.x ?? width / 2,
      ).strength(0.1),
    )
    .force(
      'y',
      forceY(
        (d: any) => clusterCenters.get(clusterMap.get(d.id)!)?.y ?? height / 2,
      ).strength(0.1),
    )
    // 碰撞半径 = 节点直径 * 1.3：在节点周围形成隔离带，
    // 既防止节点重叠，也为边留出穿行空间，避免边贴着或穿过节点
    .force('collide', forceCollide(nodeSize * 1.3))
    .velocityDecay(0.3)
    .alphaDecay(0.0228)
    .stop();

  // 同步执行 500 次迭代
  for (let i = 0; i < 500; i++) {
    simulation.tick();
  }

  // 将计算出的位置写回 G6 节点 style，并钳制在画布安全区内：
  // d3-force 无边界约束，斥力迭代累计会把无 link 力拉住的孤立节点
  // 推出画布外（窄容器副页实测：节点被边缘截断半墨）——
  // padding = 节点半径上界 + 底部标签行高（labelPlacement: bottom）
  const padding = nodeSize * 1.15;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  g6Nodes.forEach((n, i) => {
    if (!n.style) n.style = {};
    n.style.x = clamp(
      d3Nodes[i].x,
      padding,
      Math.max(padding, width - padding),
    );
    n.style.y = clamp(
      d3Nodes[i].y,
      padding,
      Math.max(padding, height - padding),
    );
  });
}

/**
 * 创建实时力导向仿真（拖拽时动态引力效果）
 *
 * 初始 alpha=0（已收敛状态），拖拽节点时通过 alpha(restart) 重新加热，
 * 连接节点跟随弹簧物理效果。onTick 回调在每帧仿真步进时触发，
 * 用于同步 d3 计算的位置到 G6 元素。
 *
 * 返回 simulation 实例和 d3 节点数组（含 fx/fy 固定位置字段）。
 */
export function createLiveSimulation(
  data: import('./types').GraphData,
  width: number,
  height: number,
  onTick: () => void,
  options?: ForceLayoutOptions,
): { simulation: any; d3Nodes: any[] } | null {
  const {
    nodeSize = NODE_SIZE,
    linkDistance = 140,
    chargeStrength = -450,
    spreadIsolated = false,
  } = options ?? {};
  const { nodes: g6Nodes, edges: g6Edges } = data;
  if (g6Nodes.length === 0) return null;

  // 从预计算位置初始化 d3 节点
  const d3Nodes = g6Nodes.map((n) => ({
    id: n.id,
    x: n.style?.x ?? width / 2,
    y: n.style?.y ?? height / 2,
    vx: 0,
    vy: 0,
  }));

  const d3Links = g6Edges
    .filter((e) => e.source !== e.target)
    .map((e) => ({ source: e.source, target: e.target }));

  // 与 computeForceLayout 一致的分簇布局：拖拽时保持簇结构
  // （含 spreadIsolated / 紧凑档参数，避免拖拽重新加热后跳回默认档）
  const clusterMap = findClusters(d3Nodes, d3Links);
  const clusterCenters = getClusterCenters(
    clusterMap,
    d3Nodes,
    width,
    height,
    spreadIsolated,
  );

  const simulation = forceSimulation(d3Nodes)
    .force(
      'link',
      forceLink(d3Links)
        .id((d: any) => d.id)
        .distance(linkDistance),
    )
    .force('charge', forceManyBody().strength(chargeStrength))
    .force(
      'x',
      forceX(
        (d: any) => clusterCenters.get(clusterMap.get(d.id)!)?.x ?? width / 2,
      ).strength(0.1),
    )
    .force(
      'y',
      forceY(
        (d: any) => clusterCenters.get(clusterMap.get(d.id)!)?.y ?? height / 2,
      ).strength(0.1),
    )
    // 碰撞半径与预计算一致：节点直径 * 1.3，节点周围形成隔离带
    .force('collide', forceCollide(nodeSize * 1.3))
    .velocityDecay(0.3)
    .alphaDecay(0.0228)
    .on('tick', onTick)
    // 初始已收敛，仅拖拽时重新加热
    .alpha(0)
    .stop();

  return { simulation, d3Nodes };
}

/**
 * Behaviors 配置
 * 替代 ECharts roam/draggable/scaleLimit
 */
export const GRAPH_BEHAVIORS = [
  // 滚轮缩放（对应 scaleLimit: { min: 0.5, max: 3 }）
  {
    type: 'zoom-canvas',
    key: 'zoom-canvas',
    zoomRange: [0.2, 3] as [number, number],
  },
  // 画布平移（对应 roam: true 的平移部分）
  {
    type: 'drag-canvas',
    key: 'drag-canvas',
  },
  // 节点拖拽（对应 draggable: true）
  {
    type: 'drag-element',
    key: 'drag-element',
  },
  // hover 高亮（对应 ECharts emphasis）
  {
    type: 'hover-activate',
    key: 'hover-activate',
    degree: 0,
    state: 'emphasis',
  },
];

/**
 * 数据转换：ECharts filteredGraphData → G6 GraphData
 * source===target 的边直接保留，G6 原生渲染自环
 */
export function toG6Data(
  filtered: { data: any[]; links: any[] },
  nodeInstanceCountMap?: Record<string, number>,
  edgeInstanceCountMap?: Record<string, number>,
  categoryColorMap?: Map<string, CategoryColor>,
): import('./types').GraphData {
  return {
    nodes: filtered.data.map((n) => {
      const catCode = n.categoryCode || UNCATEGORIZED_CAT_CODE;
      return {
        id: n.id || n.code,
        data: {
          code: n.code || n.id,
          name: n.name,
          ...(n.categoryCode ? { categoryCode: n.categoryCode } : {}),
          ...n,
        },
        style: getNodeStyle(
          { id: n.id || n.code, data: { code: n.code || n.id, name: n.name } },
          nodeInstanceCountMap?.[(n.code || n.id || '').toLowerCase()],
          categoryColorMap?.get(catCode),
        ),
      };
    }),
    edges: filtered.links.map((l: any, i: number) => ({
      id: `edge-${l.source}-${l.target}-${l.code || l.value}-${i}`,
      source: l.source,
      // source===target 时 G6 原生渲染自关联 loop edge
      target: l.target,
      data: {
        code: l.code || l.value,
        displayName: l.displayName || l.value || '',
        sourceName: l.sourceName || '',
        targetName: l.targetName || '',
        ...l,
      },
      style: getEdgeStyle(
        {
          id: `edge-${l.source}-${l.target}-${l.code || l.value}-${i}`,
          source: l.source,
          target: l.target,
          data: {
            code: l.code || l.value,
            displayName: l.displayName || l.value || '',
            sourceName: l.sourceName || '',
            targetName: l.targetName || '',
            isSelfAssoc: l.isSelfAssoc,
          },
        },
        edgeInstanceCountMap?.[(l.code || l.value || '').toLowerCase()],
      ),
    })),
  };
}

// ─── 实例全数据图谱专用样式（FullDataGraphView） ───

/**
 * 实例图谱配色板：与项目 ECharts 主题一致的 10 色轮转。
 * 每个 category 按出现顺序循环取色。
 */
const INSTANCE_COLORS = [
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

/**
 * 将十六进制颜色按比例调深，用于生成比填充色深一号的同色系边框。
 * ratio 为向黑色靠拢的比例（0~1），支持 #rgb / #rrggbb 两种写法。
 */
function darkenColorHex(hex: string, ratio: number): string {
  const m = hex.replace('#', '');
  const full =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const num = parseInt(full, 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - ratio));
  const g = Math.round(((num >> 8) & 0xff) * (1 - ratio));
  const b = Math.round((num & 0xff) * (1 - ratio));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * 实例图谱节点样式
 * - 动态大小：30 + degree * 3（max 60）
 * - 分类配色：按 category index 从 INSTANCE_COLORS 取色
 * - 描边：同色系加深 22%
 */
export function getInstanceNodeStyle(
  node: {
    id: string;
    data: { name?: string; category?: number; value?: number };
  },
  categoryColors: string[],
): Record<string, any> {
  const cat = node.data.category ?? 0;
  const fill =
    categoryColors[cat % categoryColors.length] ?? INSTANCE_COLORS[0];
  const degree = node.data.value ?? 0;
  const size = Math.min(30 + degree * 3, 60);
  return {
    fill,
    stroke: darkenColorHex(fill, 0.22),
    lineWidth: 2,
    shadowBlur: 6,
    shadowColor: 'rgba(0,0,0,0.1)',
    size,
    zIndex: 10,
    labelText: node.data.name || node.id,
    labelFill: '#333',
    labelFontSize: 10,
    labelPlacement: 'right',
  };
}

/**
 * 实例图谱边样式
 * - 箭头：endArrowSize 8
 * - 弧度：quadratic 边自带
 * - 标签：边 label 沿连线方向
 */
export function getInstanceEdgeStyle(
  edge: { data: { label?: string } },
  sourceFill?: string,
): Record<string, any> {
  return {
    stroke: sourceFill ?? '#b0c4de',
    lineWidth: 1.5,
    opacity: 0.6,
    zIndex: 1,
    endArrow: true,
    endArrowSize: 8,
    labelText: edge.data?.label || '',
    labelFill: '#888',
    labelFontSize: 9,
    labelAutoRotate: true,
  };
}

/**
 * 数据转换：实例全数据图谱 → G6 GraphData
 *
 * 与 toG6Data 的区别：
 * - 节点 id 为 `${code}::${vid}` 格式（非 objectCode）
 * - 分类配色使用 INSTANCE_COLORS 而非 CATEGORY_PALETTE
 * - 节点大小按度数动态计算
 * - 边使用源节点颜色渐变 + 箭头
 *
 * @param nodes GraphNode[] (含 id, name, objectCode, objectName, category, props, value)
 * @param edges GraphLink[] (含 source, target, label)
 * @param categories GraphCategory[] (含 name, itemStyle.color)
 */
export function toInstanceG6Data(
  nodes: any[],
  edges: any[],
  categories: any[],
): import('./types').GraphData {
  const categoryColors =
    categories.length > 0
      ? categories.map((c: any) => c?.itemStyle?.color || INSTANCE_COLORS[0])
      : INSTANCE_COLORS;
  // 缓存节点 id → fill，供边取源节点颜色
  const nodeColorMap = new Map<string, string>();
  return {
    nodes: nodes.map((n: any) => {
      const cat = n.category ?? 0;
      const fill =
        categoryColors[cat % categoryColors.length] ?? INSTANCE_COLORS[0];
      nodeColorMap.set(n.id, fill);
      return {
        id: n.id,
        data: {
          // 实例节点无 schema code，以所属对象类型编码充当
          code: n.objectCode ?? '',
          name: n.name,
          objectCode: n.objectCode,
          objectName: n.objectName,
          category: n.category,
          props: n.props,
          value: n.value,
          fillColor: fill,
        },
        style: getInstanceNodeStyle(
          {
            id: n.id,
            data: { name: n.name, category: n.category, value: n.value },
          },
          categoryColors,
        ),
      };
    }),
    edges: edges.map((l: any, i: number) => ({
      id: `edge-${l.source}-${l.target}-${l.label || ''}-${i}`,
      source: l.source,
      target: l.target,
      data: {
        code: l.label || '',
        displayName: l.label || '',
        sourceName: '',
        targetName: '',
        label: l.label || '',
      },
      style: getInstanceEdgeStyle(
        { data: { label: l.label } },
        nodeColorMap.get(l.source),
      ),
    })),
  };
}
