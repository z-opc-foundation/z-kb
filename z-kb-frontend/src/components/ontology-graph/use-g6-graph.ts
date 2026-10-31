/**
 * G6 v5 生命周期 React Hook
 *
 * 自 galaxy-meta src/pages/brain/graph/useG6Graph.ts 平移。封装 G6 Graph
 * 实例的创建/销毁/数据更新，暴露 echarts-like 命令式 API。
 *
 * 核心映射：
 * - echartsOption → setData() + GraphOptions
 * - onChartEvents → graph.on('node:click', ...) 等
 * - dispatchAction(highlight/downplay) → setElementState()
 * - setOption(路径高亮) → setElementState(batch)
 * - setOption(center:null,zoom:1) → fitView()
 * - dispatchAction(hideTip) → tooltip 隐藏
 */

import { Graph, type GraphOptions } from '@antv/g6';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeForceLayout,
  createLiveSimulation,
  GRAPH_BEHAVIORS,
  STATE_STYLES,
  type ForceLayoutOptions,
} from './styles';
import type { GraphData } from './types';

// 首次渲染前的容器尺寸稳定等待时长（ms）：
// Drawer 打开动画等场景容器尺寸连续变化，等其稳定后再布局，
// 避免按中间尺寸布局导致节点分布与最终视口不匹配
const SIZE_SETTLE_DELAY = 120;

// fitView 内边距（对应 ECharts 时代视图重置的留白）
const FIT_VIEW_PADDING: [number, number, number, number] = [10, 10, 10, 10];

/**
 * 适配视口但不放大。
 *
 * G6 v5 fitView 默认 when:'always'，内容小于视口时会把内容放大到
 * 铺满画布——少节点图谱（如场景库 7 节点）的节点视觉尺寸会远大于
 * 多节点图谱缩小适配（如本体库）的观感，两边默认大小不一致。
 * 内容被放大（zoom > 1）时恢复 1:1 缩放并居中，保证默认视图的
 * 位置（居中）和大小（不放大）与本体库保持一致。
 */
async function fitViewNoZoomIn(graph: Graph): Promise<void> {
  // padding 由 GraphOptions.padding 提供（G6 5.1.1 fitView 无参，自动取画布 padding）
  await graph.fitView();
  if (graph.destroyed) return;
  if (graph.getZoom() > 1) {
    // 内容小于视口：恢复 1:1（zoomTo 以视口中心为锚）后居中
    await graph.zoomTo(1);
    if (graph.destroyed) return;
    await graph.fitCenter();
  }
}

// ─── Hook Options ───
export interface UseG6GraphOptions {
  /** 缩放范围，对应 ECharts scaleLimit [0.5, 3] */
  zoomRange?: [number, number];
  /** 节点点击回调（params 适配为 echarts-like 格式） */
  onNodeClick?: (params: any) => void;
  /** 节点双击回调（params 适配为 echarts-like 格式） */
  onNodeDoubleClick?: (params: any) => void;
  /** 边点击回调 */
  onEdgeClick?: (params: any) => void;
  /** 节点右键回调 */
  onNodeContextMenu?: (params: any) => void;
  /** 节点 hover 回调（对应 ECharts mouseover node，联动外部清单高亮） */
  onNodeHover?: (params: any) => void;
  /** 边 hover 回调（对应 ECharts mouseover edge） */
  onEdgeHover?: (params: any) => void;
  /** hover 离开元素回调（对应 ECharts mouseout） */
  onHoverLeave?: () => void;
  /** tooltip formatter（返回 HTML 字符串） */
  tooltipFormatter?: (data: any, type: 'node' | 'edge') => string;
  /** 力导向布局档位（紧凑画布/小节点场景传紧凑档；默认本体库大节点档） */
  forceLayoutOptions?: ForceLayoutOptions;
  /** 右键菜单显示状态 ref（显示时屏蔽 tooltip） */
  ctxMenuOpenRef?: React.MutableRefObject<boolean>;
  /** 节点实例数 ref（动态读取） */
  nodeInstanceCountRef?: React.MutableRefObject<Record<string, number>>;
  /** 边实例数 ref */
  edgeInstanceCountRef?: React.MutableRefObject<Record<string, number>>;
}

// ─── Hook Return ───
export interface UseG6GraphReturn {
  /** 容器 div ref（callback ref，支持条件渲染场景） */
  containerRef: React.Ref<HTMLDivElement>;
  /** 设置/更新图谱数据（对应 echartsOption.data/links 变化）
   *  opts.settle：筛选/隐藏等数据更新场景，draw 完成后立即追加第二遍 draw
   *  重算边几何并适配视口（零延迟无缝修正悬空边） */
  setData: (data: GraphData, opts?: { settle?: boolean }) => void;
  /** 高亮节点（对应 dispatchAction highlight node） */
  highlightNode: (code: string) => void;
  /** 高亮边（对应 dispatchAction highlight edge） */
  highlightEdge: (code: string) => void;
  /** 清除所有高亮（对应 dispatchAction downplay） */
  clearHighlight: () => void;
  /** 应用路径高亮样式（对应路径高亮 setOption） */
  applyPathStyle: (
    nodeKeys: Set<string>,
    edgeKeys: Set<string>,
    lastNodeKey: string,
    lastEdgeKey: string,
  ) => void;
  /** 还原路径样式（对应退出路径模式 setOption 还原） */
  resetPathStyle: () => void;
  /** 重置视图（对应 setOption center:null zoom:1） */
  fitView: () => void;
  /** 隐藏 tooltip（对应 dispatchAction hideTip） */
  hideTooltip: () => void;
  /** G6 实例是否已就绪 */
  ready: boolean;
}

/**
 * 适配 G6 事件 → echarts-like params
 * 使业务回调（handlePathPick/enterPathAndSelect/setSelectedCode）零改动
 */
function adaptEventParams(e: any, dataType: 'node' | 'edge', graph?: any): any {
  const target = e?.target;
  const id = target?.id || e?.itemId || '';

  // G6 v5 事件 target 是 DisplayObject，不含用户数据。
  // 通过 graph 数据模型获取完整的元素数据（含 data/style 字段）。
  let rawDatum: any = {};
  if (graph && id) {
    try {
      const list =
        dataType === 'node' ? graph.getNodeData([id]) : graph.getEdgeData([id]);
      rawDatum = list?.[0] || {};
    } catch {
      /* 元素可能已销毁 */
    }
  }
  const data = rawDatum.data || {};
  const mergedData: Record<string, any> = {
    ...data,
    id: rawDatum.id || id,
    code: data.code || data.value || rawDatum.id || id,
    name: data.name || data.displayName || '',
  };
  if (rawDatum.source) mergedData.source = rawDatum.source;
  if (rawDatum.target) mergedData.target = rawDatum.target;

  // G6 5.1.1 事件对象上没有 canvasPoint/point/clientPoint 属性，
  // 真实坐标字段是 viewport/client（自有 Point，经 G6 behavior 浅拷贝转发后仍保留）：
  // - viewport：client 减画布矩形（CSS 像素、未应用 camera），
  //   对齐 ECharts offsetX/offsetY 语义；此前误取不存在的 canvasPoint
  //   导致右键菜单恒定位到 (0,0)
  // - client：浏览器视口坐标，nativeEvent 原生 clientX/Y 兜底
  const canvasPoint = e?.viewport ||
    e?.canvasPoint ||
    e?.point || { x: 0, y: 0 };
  const clientPoint = e?.client ||
    e?.clientPoint || {
      x: e?.nativeEvent?.clientX || 0,
      y: e?.nativeEvent?.clientY || 0,
    };
  return {
    dataType,
    data: mergedData,
    name: data.name || data.displayName || id,
    event: {
      event: {
        offsetX: canvasPoint.x || 0,
        offsetY: canvasPoint.y || 0,
        clientX: clientPoint.x || 0,
        clientY: clientPoint.y || 0,
        preventDefault: () => e?.preventDefault?.(),
      },
    },
  };
}

export function useG6Graph(options: UseG6GraphOptions): UseG6GraphReturn {
  const {
    // layout 已移除：G6 v5 animation:false 时 preLayout 同步失效，
    // 改用 computeForceLayout 预计算位置写入 style.x/y
    zoomRange = [0.2, 3],
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onNodeContextMenu,
    onNodeHover,
    onEdgeHover,
    onHoverLeave,
    tooltipFormatter,
    forceLayoutOptions,
    ctxMenuOpenRef,
    nodeInstanceCountRef,
    edgeInstanceCountRef,
  } = options;

  // 使用 useRef + useState + useEffect 管理 Graph 生命周期：
  // 1. callback ref 仅跟踪容器挂载/卸载 → 设置 containerReady state
  // 2. useEffect([containerReady]) 在容器就绪后创建 Graph
  //
  // 此模式比直接在 callback ref 中创建 Graph 更可靠：
  // - useEffect 在浏览器 paint 后执行，确保容器有正确尺寸
  // - 避免 React commit 阶段创建 Graph 的时序问题
  // - cleanup 在组件卸载/容器移除时自动销毁 Graph
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const graphRef = useRef<Graph | null>(null);
  const [ready, setReady] = useState(false);
  // 缓存路径高亮前应用的 state，用于退出时还原
  const pathAppliedRef = useRef(false);
  // 缓存上一次 data，用于 setData 时做增量
  const lastDataRef = useRef<GraphData | null>(null);
  // 首次渲染待定数据：等待容器尺寸稳定后再执行布局与渲染
  const pendingDataRef = useRef<GraphData | null>(null);
  // 尺寸稳定防抖定时器
  const sizeSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 容器尺寸监听：待渲染期间尺寸每次变化都重置稳定计时
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // schedulePendingRender 的转发 ref（ResizeObserver 回调中调用，避免声明顺序依赖）
  const pendingRenderSchedulerRef = useRef<() => void>(() => {});
  // 跟踪 graph.render()/draw() 是否已完成：
  // setElementState 在渲染未完成时会访问未初始化的内部渲染对象（.draw()），
  // 导致 "Cannot read properties of undefined (reading 'draw')" 运行时错误
  const renderedRef = useRef(false);
  // 实时力仿真（拖拽时动态引力）
  const simulationRef = useRef<any>(null);
  const d3NodesRef = useRef<any[]>([]);
  const draggedNodeIdRef = useRef<string | null>(null);
  // 布局档位 ref：setData 时读取（对象字面量每渲染新建，ref 避免回调依赖抖动）
  const forceLayoutOptionsRef = useRef<ForceLayoutOptions | undefined>(undefined);
  forceLayoutOptionsRef.current = forceLayoutOptions;
  // 回调 ref，避免事件重绑
  const callbacksRef = useRef({
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onNodeContextMenu,
    onNodeHover,
    onEdgeHover,
    onHoverLeave,
    tooltipFormatter,
    ctxMenuOpenRef,
    nodeInstanceCountRef,
    edgeInstanceCountRef,
  });
  callbacksRef.current = {
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onNodeContextMenu,
    onNodeHover,
    onEdgeHover,
    onHoverLeave,
    tooltipFormatter,
    ctxMenuOpenRef,
    nodeInstanceCountRef,
    edgeInstanceCountRef,
  };

  // callback ref：仅跟踪容器挂载/卸载
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;
      setContainerReady(true);
    } else {
      containerRef.current = null;
      setContainerReady(false);
    }
  }, []);

  // useEffect：容器就绪后创建 Graph，容器移除时销毁
  useEffect(() => {
    if (!containerReady) return;
    const node = containerRef.current;
    if (!node || graphRef.current) return;

    const graphOptions: GraphOptions = {
      container: node,
      autoResize: true,
      animation: false,
      data: { nodes: [], edges: [] },
      padding: FIT_VIEW_PADDING,
      // 不设置 G6 内置 layout — 使用 computeForceLayout 预计算位置
      // 避免 G6 preLayout 在 animation:false 时与预计算位置冲突
      zoomRange,
      behaviors: GRAPH_BEHAVIORS,
      // 处理平行边和自环边：分散模式自动将多条自环分配到 8 个位置
      transforms: [{ type: 'process-parallel-edges' }],
      node: {
        type: 'circle',
        state: {
          emphasis: STATE_STYLES.emphasis.node,
          pathHighlight: STATE_STYLES.pathHighlight.node,
          pathLast: STATE_STYLES.pathLast.node,
          pathDim: STATE_STYLES.pathDim.node,
        },
      },
      edge: {
        type: 'quadratic',
        state: {
          emphasis: STATE_STYLES.emphasis.edge,
          pathHighlight: STATE_STYLES.pathHighlight.edge,
          pathLast: STATE_STYLES.pathLast.edge,
          pathDim: STATE_STYLES.pathDim.edge,
        },
      },
      plugins: [
        {
          type: 'tooltip',
          key: 'tooltip',
          getContent: (e: any, items: any[]) => {
            const cb = callbacksRef.current;
            if (!cb.tooltipFormatter) return '';
            if (cb.ctxMenuOpenRef?.current) return '';
            // G6 v5 tooltip 插件传入 items 数组（来自 model.getNodeData/getEdgeData）
            const item = items?.[0];
            if (!item) return '';
            const dataType = 'source' in item ? 'edge' : 'node';
            const data: Record<string, any> = {
              ...(item.data || {}),
              id: item.id,
            };
            if (item.source) data.source = item.source;
            if (item.target) data.target = item.target;
            return cb.tooltipFormatter(data, dataType);
          },
        },
      ],
    };

    try {
      const graph = new Graph(graphOptions);
      graphRef.current = graph;

      // ─── 事件绑定 ───
      graph.on('node:click', (e: any) => {
        const params = adaptEventParams(e, 'node', graph);
        callbacksRef.current.onNodeClick?.(params);
      });

      graph.on('node:dblclick', (e: any) => {
        const params = adaptEventParams(e, 'node', graph);
        callbacksRef.current.onNodeDoubleClick?.(params);
      });

      graph.on('edge:click', (e: any) => {
        const params = adaptEventParams(e, 'edge', graph);
        callbacksRef.current.onEdgeClick?.(params);
      });

      graph.on('node:contextmenu', (e: any) => {
        e?.preventDefault?.();
        const params = adaptEventParams(e, 'node', graph);
        callbacksRef.current.onNodeContextMenu?.(params);
      });

      // ─── hover 联动（对应 ECharts mouseover/mouseout 事件） ───
      // G6 v5 官方 Pointer 事件系列（同 hover-activate behavior），
      // enter/leave 不冒泡，子图形间移动不会重复触发
      graph.on('node:pointerenter', (e: any) => {
        const params = adaptEventParams(e, 'node', graph);
        callbacksRef.current.onNodeHover?.(params);
      });
      graph.on('edge:pointerenter', (e: any) => {
        const params = adaptEventParams(e, 'edge', graph);
        callbacksRef.current.onEdgeHover?.(params);
      });
      graph.on('node:pointerleave', () => {
        callbacksRef.current.onHoverLeave?.();
      });
      graph.on('edge:pointerleave', () => {
        callbacksRef.current.onHoverLeave?.();
      });

      // ─── 拖拽动态引力（d3-force 重新加热，连接节点跟随） ───
      // G6 v5 drag-element 行为通过 translateElementBy 移动节点（visual 层），
      // 同时 emit node:dragstart/drag/dragend 事件。我们监听这些事件：
      // 1. dragstart：用节点当前 G6 数据位置初始化 fx/fy，重启仿真
      // 2. drag：用 event.dx/dy（增量）累计更新 fx/fy，仿真实时重算连接节点位置
      // 3. dragend：保持 fx/fy（节点留在拖拽位置），syncPositions 跳过有 fx/fy 的节点
      graph.on('node:dragstart', (e: any) => {
        const id = e?.target?.id || e?.itemId;
        if (!id) return;
        const d3Node = d3NodesRef.current.find((n) => n.id === id);
        if (!d3Node || !simulationRef.current) return;
        draggedNodeIdRef.current = id;
        // 用 G6 当前数据位置作为 fx/fy 初始值（比 canvasPoint 更可靠）
        const nodeData = graph.getNodeData([id])?.[0];
        const startX = Number(nodeData?.style?.x ?? d3Node.x ?? 0);
        const startY = Number(nodeData?.style?.y ?? d3Node.y ?? 0);
        d3Node.fx = startX;
        d3Node.fy = startY;
        // 重新加热仿真：alphaTarget 保持持续运动，alpha 0.3 提供适中弹性
        simulationRef.current.alphaTarget(0.3).alpha(0.3).restart();
      });

      graph.on('node:drag', (e: any) => {
        const id = draggedNodeIdRef.current;
        if (!id || !simulationRef.current) return;
        const d3Node = d3NodesRef.current.find((n) => n.id === id);
        if (!d3Node || !e) return;
        // G6 v5 drag 事件提供 dx/dy（画布增量），需除以 zoom 转为数据坐标
        const zoom = graph.getZoom();
        const dx = (e.dx ?? 0) / zoom;
        const dy = (e.dy ?? 0) / zoom;
        d3Node.fx = (d3Node.fx ?? d3Node.x ?? 0) + dx;
        d3Node.fy = (d3Node.fy ?? d3Node.y ?? 0) + dy;
        // 仿真持续运行中，确保连接节点跟随
      });

      graph.on('node:dragend', () => {
        // 停止持续加热（alphaTarget 归零），仿真自然收敛
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        // 不释放 fx/fy — 节点保持在拖拽位置，syncPositions 跳过固定节点
        draggedNodeIdRef.current = null;
      });

      setReady(true);
    } catch (err) {
      console.error('[G6] Failed to create graph:', err);
    }

    // cleanup：容器移除或组件卸载时销毁 Graph
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (sizeSettleTimerRef.current) {
        clearTimeout(sizeSettleTimerRef.current);
        sizeSettleTimerRef.current = null;
      }
      pendingDataRef.current = null;
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
        renderedRef.current = false;
        // 重置数据快照：容器重新挂载会新建 Graph，
        // 若残留旧数据会让 setData 误判为增量更新（draw 分支），
        // 在未 render 过的新实例上 draw 会失败
        lastDataRef.current = null;
        setReady(false);
      }
    };
  }, [containerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 容器就绪后监听尺寸变化：首次渲染数据待定期间（Drawer 打开动画、
  // 面板展开等场景尺寸连续变化），每次变化重置稳定计时，
  // 确保布局与 fitView 基于最终稳定尺寸计算
  useEffect(() => {
    if (!containerReady) return;
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver(() => {
      if (pendingDataRef.current) {
        pendingRenderSchedulerRef.current();
      }
    });
    resizeObserver.observe(node);
    resizeObserverRef.current = resizeObserver;
    return () => {
      resizeObserver.disconnect();
      if (resizeObserverRef.current === resizeObserver) {
        resizeObserverRef.current = null;
      }
    };
  }, [containerReady]);

  /**
   * 手动触发 @antv/g Canvas 渲染。
   *
   * animation:false 时，G6 创建元素但不触发属性变更事件
   * （因为元素属性在构造函数中设置，在挂载之前），
   * 导致 renderReasons 始终为空，RAF 循环虽运行但不执行实际渲染。
   *
   * 通过 calling renderingService.dirty() 添加 DISPLAY_OBJECT_CHANGED
   * 到 renderReasons，使下一帧 RAF tick 执行实际像素渲染。
   */
  const triggerRender = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    const canvas = (graph as any).context?.canvas;
    if (!canvas?.getLayers) return;
    // 对每个图层（background/main/label/transient）添加 render reason 并强制渲染
    Object.values(canvas.getLayers()).forEach((layer: any) => {
      const renderingService = layer?.getRenderingService?.();
      if (renderingService) {
        renderingService.dirty();
      }
      // 如果 RAF 循环未运行（frameId 为空），手动启动
      if (!layer?.frameId && typeof layer?.run === 'function') {
        layer.run();
      }
      // 强制调用 render()（检查 renderReasons 并执行实际绘制）
      if (typeof layer?.render === 'function') {
        layer.render();
      }
    });
  }, []);

  // ─── syncPositions：实时仿真 tick → G6 位置同步 ───
  // 拖拽节点时 d3-force 重新计算，每帧将新位置同步到 G6
  // 跳过有 fx/fy 的节点（被拖拽过的节点），保留 G6 drag-element 的最终位置
  const syncPositions = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    const d3Nodes = d3NodesRef.current;
    if (!d3Nodes.length) return;
    // 跳过被拖拽且已固定的节点（fx/fy != null），避免覆盖 G6 drag-element 的位置
    const nodes = d3Nodes
      .filter((n) => n.fx == null && n.fy == null)
      .map((n) => ({ id: n.id, style: { x: n.x, y: n.y } }));
    if (nodes.length === 0) return;
    graph.updateData({ nodes, edges: [] } as any);
    triggerRender();
  }, [triggerRender]);

  // ─── renderData：布局预计算 + 渲染（首次 render / 后续 draw） ───
  // fitAfter：渲染完成后重新适配视口（视图重置场景，按新布局恢复默认位置和大小）
  const renderData = useCallback(
    (data: GraphData, width: number, height: number, fitAfter?: boolean) => {
      const graph = graphRef.current;
      if (!graph || graph.destroyed) {
        return;
      }

      // 节点/边样式（fill, stroke, badge, label 等）已由 toG6Data 在调用前应用，
      // 此处无需重复调用 getNodeStyle/getEdgeStyle，仅做力导向布局预计算。

      // 预计算力导向布局位置（绕过 G6 v5 animation:false 时 preLayout 同步失效的 bug）
      computeForceLayout(data, width, height, forceLayoutOptionsRef.current);

      // 首次渲染用 render()（创建元素），后续用 draw()（增量更新）
      graph.setData(data as any);
      // G6 v5 draw 只渲染“模型变更集”：筛选/布局变化后节点位置变了（NodeUpdated），
      // 但留存边的数据（source/target/style）未变，不进变更集 → 边元素不更新，
      // 几何停留在旧端点位置（悬空边）。refreshData 把全部节点/边无条件提交变更记录，
      // 强制 draw 按新节点位置重算边几何（与拖拽后 updateData 修正边同一效果）。
      (graph as any).context?.model?.refreshData?.();
      // 渲染完成前禁止 setElementState 等操作
      renderedRef.current = false;
      if (!lastDataRef.current || lastDataRef.current.nodes.length === 0) {
        // 首次：全量 render（创建元素，位置已由 computeForceLayout 预计算）
        graph
          .render()
          .then(async () => {
            // 实例已销毁/更换（容器卸载重建）：丢弃本次结果，
            // 避免旧实例的 stale 回调污染新实例的 renderedRef 等标记
            if (graphRef.current !== graph || graph.destroyed) return;
            // 预计算的位置已写入 style.x/y，fitView 调整视口
            // await 确保 viewport 变换完成后才触发渲染，避免视口未更新导致节点重叠；
            // 内容小于视口时不放大（与本体库默认大小一致）
            await fitViewNoZoomIn(graph);
            if (graphRef.current !== graph || graph.destroyed) return;
            // animation:false 时 render 不触发像素渲染，手动添加 render reason
            triggerRender();
            // 启动实时力仿真（初始已收敛，拖拽时重新加热）
            if (simulationRef.current) {
              simulationRef.current.stop();
            }
            const simResult = createLiveSimulation(
              data,
              width,
              height,
              syncPositions,
              forceLayoutOptionsRef.current,
            );
            if (simResult) {
              simulationRef.current = simResult.simulation;
              d3NodesRef.current = simResult.d3Nodes;
            }
            renderedRef.current = true;
          })
          .catch((err: any) => {
            console.error('[G6] render failed:', err);
            // 仅当仍是当前实例时才解锁（旧实例销毁导致的 reject 不影响新实例）
            if (graphRef.current === graph) {
              renderedRef.current = true;
            }
          });
      } else {
        // 后续：增量 draw（更新元素属性 → 触发 ATTR_MODIFIED → 自动 dirty）
        graph
          .draw()
          .then(async () => {
            // 实例已销毁/更换（容器卸载重建）：丢弃本次结果
            if (graphRef.current !== graph || graph.destroyed) return;
            const needSettle = settlePendingRef.current;
            settlePendingRef.current = false;
            // settle 场景：首遍 draw 的边几何可能仍按旧端点位置计算，
            // 暂不触发像素渲染（悬空边一帧都不画出），等修正遍完成后统一渲染
            if (!needSettle) triggerRender();
            // 重建实时力仿真：数据更新后节点集合可能变化，且布局已重算，
            // 需以新布局位置重新初始化（同时清除拖拽残留的 fx/fy 固定），
            // 否则旧仿真与新数据脱节会导致后续拖拽位置跳变
            if (simulationRef.current) {
              simulationRef.current.stop();
            }
            const simResult = createLiveSimulation(
              data,
              width,
              height,
              syncPositions,
              forceLayoutOptionsRef.current,
            );
            if (simResult) {
              simulationRef.current = simResult.simulation;
              d3NodesRef.current = simResult.d3Nodes;
            }
            // 视图重置场景：draw 完成后按重算的默认布局适配视口
            if (fitAfter) {
              await fitViewNoZoomIn(graph);
              if (graphRef.current !== graph || graph.destroyed) return;
            }
            renderedRef.current = true;
            if (needSettle) {
              // 修正遍：此刻节点元素已落到新位置，refreshData 全量提交变更后
              // 再 draw 一次，边几何按新端点位置重算，随后适配视口——
              // 与手动「视图重置」同一效果，但紧跟首遍 draw 无缝完成
              (graph as any).context?.model?.refreshData?.();
              graph
                .draw()
                .then(async () => {
                  if (graphRef.current !== graph || graph.destroyed) return;
                  await fitViewNoZoomIn(graph);
                  if (graphRef.current !== graph || graph.destroyed) return;
                  triggerRender();
                })
                .catch(() => {
                  // 修正遍失败也要把首遍结果渲染出来
                  if (graphRef.current === graph) triggerRender();
                });
            }
          })
          .catch((err: any) => {
            console.error('[G6] draw failed:', err);
            if (graphRef.current === graph) {
              renderedRef.current = true;
            }
          });
      }
      lastDataRef.current = data;
    },
    [triggerRender, syncPositions],
  );

  // ─── schedulePendingRender：首次渲染前等待容器尺寸稳定 ───
  // 场景：容器在 Drawer 打开动画等过程中挂载，setData 时刻的
  // clientWidth/clientHeight 是中间值，按其布局会导致节点分布与最终
  // 视口不匹配（首次打开布局不和谐）。等尺寸稳定（SIZE_SETTLE_DELAY
  // 内无变化，ResizeObserver 回调会持续重置计时）后再用最终尺寸渲染。
  const schedulePendingRender = useCallback(() => {
    if (sizeSettleTimerRef.current) {
      clearTimeout(sizeSettleTimerRef.current);
    }
    sizeSettleTimerRef.current = setTimeout(() => {
      const pending = pendingDataRef.current;
      const container = containerRef.current;
      if (!pending || !container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) {
        // 容器尚不可见：保留待渲染数据，等 ResizeObserver 报告尺寸变化后重排
        return;
      }
      pendingDataRef.current = null;
      renderData(pending, width, height);
    }, SIZE_SETTLE_DELAY);
  }, [renderData]);
  pendingRenderSchedulerRef.current = schedulePendingRender;

  // ─── setData：数据更新 ───
  // settle 标记：筛选/隐藏操作触发的更新需在首遍 draw 后追加修正遍（见 renderData）
  const settlePendingRef = useRef(false);
  const setData = useCallback(
    (data: GraphData, opts?: { settle?: boolean }) => {
      const graph = graphRef.current;
      if (!graph || graph.destroyed) {
        return;
      }
      if (opts?.settle) settlePendingRef.current = true;

      const isFirstRender =
        !lastDataRef.current || lastDataRef.current.nodes.length === 0;
      if (isFirstRender) {
        // 首次渲染：先挂起，等容器尺寸稳定后再布局（见 schedulePendingRender）；
        // 挂起期间若数据再次更新，以最新数据为准
        pendingDataRef.current = data;
        schedulePendingRender();
        return;
      }

      // 后续更新：布局已稳定，直接用当前容器尺寸渲染
      const container = containerRef.current;
      const width = container?.clientWidth || 800;
      const height = container?.clientHeight || 600;
      renderData(data, width, height);
    },
    [renderData, schedulePendingRender],
  );

  // ─── highlightNode：高亮单个节点 ───
  // code 可能是节点 ID（实体 objectCode）或边类型 code（关系 edgeType）
  // 仅当 code 匹配某个节点 ID 时才设置 emphasis，否则静默跳过（由 highlightEdge 处理）
  const highlightNode = useCallback(
    (code: string) => {
      const graph = graphRef.current;
      if (!graph || graph.destroyed) return;
      // 先清除所有 emphasis state
      const allNodes = graph.getNodeData();
      const allEdges = graph.getEdgeData();
      const clearStates: Record<string, any> = {};
      allNodes.forEach((n: any) => {
        clearStates[n.id] = [];
      });
      allEdges.forEach((e: any) => {
        clearStates[e.id] = [];
      });
      // 检查 code 是否匹配某个节点 ID，不匹配则静默跳过（可能是边类型 code）
      const nodeExists = allNodes.some((n: any) => n.id === code);
      if (!renderedRef.current || allNodes.length === 0) return;
      Promise.resolve(graph.setElementState(clearStates))
        .then(() => {
          if (nodeExists) {
            return graph.setElementState(code, 'emphasis');
          }
        })
        .then(() => triggerRender())
        .catch(() => {
          /* graph 可能正在重建 */
        });
    },
    [triggerRender],
  );

  // ─── highlightEdge：高亮同类型全部边 ───
  // 同一关系类型（code）可能对应多条不同端点的边，
  // 外部按关系类型高亮时需命中全部（对齐 ECharts 版 forEach 行为）。
  // 无论是否命中都先清除全部高亮，避免 hoverKey 切换时残留上一个元素的高亮
  const highlightEdge = useCallback(
    (code: string) => {
      const graph = graphRef.current;
      if (!graph || graph.destroyed) return;
      if (!renderedRef.current) return;
      // 查找所有匹配的边
      const edges = graph.getEdgeData();
      const matched = edges.filter(
        (e: any) => e.data?.code === code || e.data?.value === code,
      );
      // 先清除全部高亮，再高亮所有命中边（无命中时仅清除）
      const allNodes = graph.getNodeData();
      const clearStates: Record<string, any> = {};
      allNodes.forEach((n: any) => {
        clearStates[n.id] = [];
      });
      edges.forEach((e: any) => {
        clearStates[e.id] = [];
      });
      Promise.resolve(graph.setElementState(clearStates))
        .then(() => {
          if (matched.length === 0 || graph.destroyed) return;
          const states: Record<string, any> = {};
          matched.forEach((e: any) => {
            states[e.id] = ['emphasis'];
          });
          return graph.setElementState(states);
        })
        .then(() => triggerRender())
        .catch(() => {
          /* graph 可能正在重建 */
        });
    },
    [triggerRender],
  );

  // ─── clearHighlight：清除所有高亮 ───
  const clearHighlight = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    if (!renderedRef.current) return;
    const allNodes = graph.getNodeData();
    const allEdges = graph.getEdgeData();
    const clearStates: Record<string, any> = {};
    allNodes.forEach((n: any) => {
      clearStates[n.id] = [];
    });
    allEdges.forEach((e: any) => {
      clearStates[e.id] = [];
    });
    Promise.resolve(graph.setElementState(clearStates))
      .then(() => triggerRender())
      .catch(() => {
        /* graph 可能正在重建 */
      });
  }, [triggerRender]);

  // ─── applyPathStyle：路径高亮 ───
  const applyPathStyle = useCallback(
    (
      nodeKeys: Set<string>,
      edgeKeys: Set<string>,
      lastNodeKey: string,
      lastEdgeKey: string,
    ) => {
      const graph = graphRef.current;
      if (!graph || graph.destroyed) return;

      // 收集所有节点和边 ID → state 映射
      const stateMap: Record<string, string[]> = {};

      // 节点
      const allNodes = graph.getNodeData();
      allNodes.forEach((n: any) => {
        const nodeId = n.id;
        // 用 code 匹配 pathNodeKey（getPathNodeKey 用 n.id 或 n.code）
        const nodeCode = n.data?.code || n.id;
        if (nodeKeys.has(nodeCode) || nodeKeys.has(nodeId)) {
          if (nodeCode === lastNodeKey || nodeId === lastNodeKey) {
            stateMap[nodeId] = ['pathLast'];
          } else {
            stateMap[nodeId] = ['pathHighlight'];
          }
        } else {
          stateMap[nodeId] = ['pathDim'];
        }
      });

      // 边
      const allEdges = graph.getEdgeData();
      allEdges.forEach((e: any) => {
        const edgeId = e.id;
        const edgeValue = e.data?.value ?? e.data?.code;
        const sourceCode = e.source;
        const targetCode = e.target;
        // 与 getPathEdgeKey 格式对齐：`${source}->${target}::${value}`
        const edgeKey = `${sourceCode}->${targetCode}::${edgeValue}`;
        if (edgeKeys.has(edgeKey) || edgeKeys.has(edgeValue)) {
          if (edgeKey === lastEdgeKey || edgeValue === lastEdgeKey) {
            stateMap[edgeId] = ['pathLast'];
          } else {
            stateMap[edgeId] = ['pathHighlight'];
          }
        } else {
          stateMap[edgeId] = ['pathDim'];
        }
      });

      // 渲染未完成时跳过：setElementState 会访问未初始化的内部渲染对象
      if (!renderedRef.current || allNodes.length === 0) return;
      pathAppliedRef.current = true;
      Promise.resolve(graph.setElementState(stateMap))
        .then(() => triggerRender())
        .catch(() => {
          /* graph 可能正在重建 */
        });
    },
    [triggerRender],
  );

  // ─── resetPathStyle：还原路径样式 ───
  const resetPathStyle = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    if (!pathAppliedRef.current) return;
    if (!renderedRef.current) return;

    const allNodes = graph.getNodeData();
    const allEdges = graph.getEdgeData();
    const clearStates: Record<string, any> = {};
    allNodes.forEach((n: any) => {
      clearStates[n.id] = [];
    });
    allEdges.forEach((e: any) => {
      clearStates[e.id] = [];
    });
    pathAppliedRef.current = false;
    Promise.resolve(graph.setElementState(clearStates))
      .then(() => triggerRender())
      .catch(() => {
        /* graph 可能正在重建 */
      });
  }, [triggerRender]);

  // ─── fitView：重置视图（「视图重置」按钮） ───
  // 恢复到与首次渲染一致的默认位置和大小：重新执行确定性布局
  // （相同数据+尺寸必得相同默认位置，清除拖拽造成的节点偏移与重叠）、
  // 重建拖拽仿真（清除 fx/fy 固定）、适配视口且不放大
  const fitView = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    const data = lastDataRef.current;
    if (!data || data.nodes.length === 0) {
      // 无数据：仅适配视口
      fitViewNoZoomIn(graph).then(() => triggerRender());
      return;
    }
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;
    renderData(data, width, height, true);
  }, [renderData, triggerRender]);

  // ─── hideTooltip：隐藏 tooltip ───
  const hideTooltip = useCallback(() => {
    // G6 v5 tooltip 是插件，通过 emit 事件隐藏
    const graph = graphRef.current;
    if (!graph || graph.destroyed) return;
    // 直接操作 tooltip 插件
    try {
      const tooltip = (graph as any).context?.plugin?.get?.('tooltip');
      if (tooltip && typeof tooltip.hide === 'function') {
        tooltip.hide();
      }
    } catch {
      // tooltip 插件可能未就绪，忽略
    }
  }, []);

  return {
    containerRef: setContainerRef,
    setData,
    highlightNode,
    highlightEdge,
    clearHighlight,
    applyPathStyle,
    resetPathStyle,
    fitView,
    hideTooltip,
    ready,
  };
}
