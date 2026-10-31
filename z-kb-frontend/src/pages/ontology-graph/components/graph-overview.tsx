/**
 * 对象层图谱交互视图（GraphOverview）。
 * 自 galaxy-meta OntologyBrowse 的图谱区平移：G6 力导向画布 +
 * 路径选择状态机（自动寻路 / 候选路径 / 回退）+ 右键菜单入口。
 * 左侧对象清单、分类管理、浮动实例窗口等 meta 侧依赖写接口的能力不在此范围。
 */
import { toG6Data, useG6Graph, type CategoryColor } from '@/components/ontology-graph';
import Icon from '@/components/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphLinkItem, GraphNodeItem, PathStep } from '../types';
import { usePathSelection } from '../hooks/use-path-selection';
import {
  getCandidatePathMeta,
  getPathEdgeKey,
  getPathEdgeLabel,
  getPathNodeKey,
  getPathNodeLabel,
  normalizePathDirection,
} from '../utils/path-search';

interface GraphOverviewProps {
  loading: boolean;
  failed: boolean;
  graphData: { data: GraphNodeItem[]; links: GraphLinkItem[] };
  categoryColorMap: Map<string, CategoryColor>;
  tagInstanceCountRef: React.MutableRefObject<Record<string, number>>;
  edgeInstanceCountRef: React.MutableRefObject<Record<string, number>>;
  onRetryReload: () => void;
  /** 路径确认（查看详情）：新建 logic-chain 标签页 */
  onConfirmChain: (pathData: PathStep[]) => void;
  /** 右键菜单「查看对象详情」：单对象直接进入实例数据详情 */
  onOpenNodeChain: (objectCode: string) => void;
  /** 右键菜单「查看实例图谱」：单对象实例数据图谱标签页 */
  onOpenInstanceGraph: (objectCode: string) => void;
}

/** 右键菜单：宽高与样式（min-width 124 / 2 项）保持一致，供靠边钳制 */
const CTX_MENU_W = 124;
const CTX_MENU_H = 52;

export function GraphOverview(props: GraphOverviewProps) {
  const {
    loading,
    failed,
    graphData,
    categoryColorMap,
    tagInstanceCountRef,
    edgeInstanceCountRef,
    onRetryReload,
    onConfirmChain,
    onOpenNodeChain,
    onOpenInstanceGraph,
  } = props;

  const confirmChain = useCallback(
    (path: PathStep[]) => {
      // 全反向链路自动翻转为正向，符合「起点→中间→终点」的阅读习惯
      onConfirmChain(normalizePathDirection(path));
    },
    [onConfirmChain],
  );

  const path = usePathSelection(graphData, confirmChain);

  // ─── 节点右键菜单 ───
  const [contextMenu, setContextMenu] = useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  // 右键菜单显示状态 ref：tooltip formatter 闭包内读取，显示期间屏蔽提示框
  const ctxMenuOpenRef = useRef(false);
  ctxMenuOpenRef.current = contextMenu != null;

  // ─── G6 v5 图谱 hook ───
  const graphApi = useG6Graph({
    zoomRange: [0.5, 3],
    ctxMenuOpenRef,
    nodeInstanceCountRef: tagInstanceCountRef,
    edgeInstanceCountRef: edgeInstanceCountRef,
    onNodeClick: path.handleGraphClick,
    onEdgeClick: path.handleGraphClick,
    onNodeContextMenu: (params: {
      data?: { code?: string; id?: string };
      name?: string;
      event?: { event?: { offsetX?: number; offsetY?: number } };
    }) => {
      const code = params.data?.code || params.data?.id || params.name;
      if (!code) return;
      // 立即隐藏已显示的提示框，避免与右键菜单重叠
      graphApi.hideTooltip();
      setContextMenu({
        code,
        x: params.event?.event?.offsetX || 0,
        y: params.event?.event?.offsetY || 0,
      });
    },
    tooltipFormatter: (
      data: {
        code?: string;
        id?: string;
        name?: string;
        displayName?: string;
        value?: string;
        sourceName?: string;
        source?: string;
        targetName?: string;
        target?: string;
      },
      type: 'node' | 'edge',
    ) => {
      if (type === 'node') {
        const cnt =
          tagInstanceCountRef.current[
            (data.code || data.id || '').toLowerCase()
          ];
        return (
          `<span style="font-size:11px;font-weight:600;color:#0f1b2d">${data.name}</span>` +
          (cnt != null
            ? `<span style="font-size:10px;color:#68778e;margin-left:8px">实例：<span style="color:#0f1b2d;font-weight:600">${cnt}</span></span>`
            : '')
        );
      }
      const edgeName = data?.displayName || data?.value || '';
      const sn = data?.sourceName || data?.source || '';
      const tn = data?.targetName || data?.target || '';
      const cnt =
        edgeInstanceCountRef.current[
          (data?.code || data?.value || '').toLowerCase()
        ];
      return (
        `<div style="font-size:12px;font-weight:600;color:#0f1b2d;margin-bottom:4px">${edgeName}</div>` +
        `<div style="font-size:11px;color:#68778e">${sn} <span style="color:#c4cdd6">→</span> ${tn}</div>` +
        (cnt != null
          ? `<div style="font-size:11px;color:#68778e">实例：<span style="color:#0f1b2d;font-weight:600">${cnt}</span></div>`
          : '')
      );
    },
  });

  // 图谱数据变化时更新 G6
  const graphApiReady = graphApi.ready;
  const graphApiSetData = graphApi.setData;
  useEffect(() => {
    if (graphData.data.length === 0) return;
    if (!graphApiReady) return;
    const g6Data = toG6Data(
      graphData,
      tagInstanceCountRef.current,
      edgeInstanceCountRef.current,
      categoryColorMap,
    );
    graphApiSetData(g6Data);
  }, [
    graphData,
    graphApiReady,
    graphApiSetData,
    categoryColorMap,
    tagInstanceCountRef,
    edgeInstanceCountRef,
  ]);

  // 路径选择高亮：selectedPath 变化时增量更新元素样式；退出路径模式时还原
  const graphApiResetPath = graphApi.resetPathStyle;
  const graphApiApplyPath = graphApi.applyPathStyle;
  useEffect(() => {
    if (!graphApiReady) return;
    if (!path.pathSelectionMode) {
      graphApiResetPath();
      return;
    }
    const nodeKeys = new Set<string>();
    const edgeKeys = new Set<string>();
    path.selectedPath.forEach((step) => {
      if (step.type === 'node') nodeKeys.add(getPathNodeKey(step.data));
      else edgeKeys.add(getPathEdgeKey(step.data));
    });
    // 路径末尾元素额外加深描边，提示「再次点击可回退一步」
    const lastStep = path.selectedPath[path.selectedPath.length - 1];
    const lastNodeKey =
      lastStep?.type === 'node' ? getPathNodeKey(lastStep.data) : '';
    const lastEdgeKey =
      lastStep?.type === 'edge' ? getPathEdgeKey(lastStep.data) : '';
    graphApiApplyPath(nodeKeys, edgeKeys, lastNodeKey, lastEdgeKey);
  }, [
    path.pathSelectionMode,
    path.selectedPath,
    graphApiReady,
    graphApiResetPath,
    graphApiApplyPath,
  ]);

  // 右键菜单：点击外部或 Escape 关闭
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    // setTimeout(0)：避免唤出菜单的同一次 mousedown 立即把菜单关掉
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const handleResetView = useCallback(() => {
    graphApi.fitView();
  }, [graphApi]);

  /** 数字输入变更：空值回落默认，越界钳制到 min/max */
  const clampNumber = (raw: string, min: number, max: number, fallback: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const candidateMetas = useMemo(
    () => path.candidatePaths.map((p) => getCandidatePathMeta(p)),
    [path.candidatePaths],
  );

  const hasData = graphData.data.length > 0;

  return (
    <div className="og-canvas">
      {failed ? (
        <div className="og-canvas-state">
          <span>图谱数据加载失败</span>
          <button className="btn xs ghost" type="button" onClick={onRetryReload}>
            重试
          </button>
        </div>
      ) : loading ? (
        <div className="og-canvas-state">
          <span className="spinner" />
          正在加载图谱数据…
        </div>
      ) : hasData ? (
        <div className="og-chart-box" ref={chartBoxRef}>
          <div ref={graphApi.containerRef} style={{ height: '100%', width: '100%' }} />

          {/* 左上角工具条：范围胶囊 + 路径选择 + 视图重置 */}
          <div className="og-topleft-bar">
            <div
              className="og-scope-tip"
              role="button"
              tabIndex={0}
              title="点击退出路径选择，查看全部对象"
              onClick={path.exitPathSelection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  path.exitPathSelection();
                }
              }}
            >
              全部对象
            </div>
            <button
              type="button"
              className={`og-pill-btn og-path-btn${
                path.pathSelectionMode ? ' og-path-btn-active' : ''
              }`}
              title={
                path.pathSelectionMode
                  ? '退出路径选择（ESC）'
                  : '点选节点与连线生成逻辑链路，也可仅选一个对象直接查看'
              }
              onClick={path.togglePathSelection}
            >
              <Icon name="link" size={11} />
              {path.pathSelectionMode ? '取消选择' : '路径选择'}
            </button>
            <button
              type="button"
              className="og-pill-btn"
              title="将图谱视图恢复到默认位置和大小"
              onClick={handleResetView}
            >
              <Icon name="target" size={11} />
              视图重置
            </button>
          </div>

          {/* 路径搜索参数面板（右上角） */}
          {path.pathSelectionMode && (
            <div className="og-path-params-panel">
              <span className="og-path-params-label">最大跳数</span>
              <input
                type="number"
                className={`og-path-params-input${path.pathMaxDepth >= 10 ? ' is-warn' : ''}`}
                title="跳数较大，复杂图谱下搜索可能较慢"
                min={2}
                max={12}
                value={path.pathMaxDepth}
                onChange={(e) =>
                  path.setPathMaxDepth(
                    clampNumber(e.target.value, 2, 12, 8),
                  )
                }
              />
              <span className="og-path-params-label">最大结果</span>
              <input
                type="number"
                className={`og-path-params-input${path.pathMaxResults >= 30 ? ' is-warn' : ''}`}
                title="结果数较多，可能影响搜索速度"
                min={1}
                max={50}
                value={path.pathMaxResults}
                onChange={(e) =>
                  path.setPathMaxResults(
                    clampNumber(e.target.value, 1, 50, 10),
                  )
                }
              />
            </div>
          )}

          {/* 可选路径浮动面板：头部 ◀ X/N ▶ 切换 + 卡片列表 */}
          {path.pathSelectionMode && path.candidatePaths.length > 1 && (
            <div
              className={`og-path-candidates-panel${
                path.candidatesPanelCollapsed ? ' is-collapsed' : ''
              }`}
            >
              <div className="og-path-candidates-panel-header">
                <span className="og-path-candidates-panel-title">可选路径</span>
                <span className="og-path-candidates-header-right">
                  <span className="og-path-candidates-switcher">
                    <button
                      type="button"
                      className="og-cand-arrow"
                      disabled={path.activePathIdx === 0}
                      onClick={() => path.switchCandidatePath(path.activePathIdx - 1)}
                    >
                      ◀
                    </button>
                    <span className="og-cand-count">
                      {path.activePathIdx + 1}/{path.candidatePaths.length}
                    </span>
                    <button
                      type="button"
                      className="og-cand-arrow"
                      disabled={
                        path.activePathIdx === path.candidatePaths.length - 1
                      }
                      onClick={() => path.switchCandidatePath(path.activePathIdx + 1)}
                    >
                      ▶
                    </button>
                  </span>
                  <button
                    type="button"
                    className="og-cand-toggle"
                    title={path.candidatesPanelCollapsed ? '展开' : '收起'}
                    onClick={() =>
                      path.setCandidatesPanelCollapsed(!path.candidatesPanelCollapsed)
                    }
                  >
                    {path.candidatesPanelCollapsed ? '▼' : '▲'}
                  </button>
                </span>
              </div>
              {!path.candidatesPanelCollapsed && (
                <div className="og-path-candidates-list">
                  {path.candidatePaths.map((candidate, idx) => {
                    const meta = candidateMetas[idx];
                    const isActive = idx === path.activePathIdx;
                    return (
                      <div
                        key={idx}
                        className={`og-path-candidate-card${isActive ? ' is-active' : ''}`}
                        onClick={() => path.switchCandidatePath(idx)}
                        title={meta.summary}
                      >
                        <div className="og-cand-card-top">
                          <span className="og-cand-card-idx">路径 {idx + 1}</span>
                          <span className="og-cand-card-hops">
                            {meta.edgeCount} 跳
                          </span>
                        </div>
                        <div className="og-cand-card-endpoints">
                          <span
                            className="og-cand-endpoint"
                            title={meta.startName}
                          >
                            {meta.startName}
                          </span>
                          <span className="og-cand-arrow-text">→</span>
                          <span className="og-cand-endpoint" title={meta.endName}>
                            {meta.endName}
                          </span>
                        </div>
                        <div className="og-cand-card-stats">
                          <span>
                            <span className="og-cand-stat-num">{meta.nodeCount}</span>{' '}
                            <span className="og-cand-stat-label">对象</span>
                          </span>
                          <span className="og-cand-stat-sep">·</span>
                          <span>
                            <span className="og-cand-stat-num">{meta.edgeCount}</span>{' '}
                            <span className="og-cand-stat-label">关系</span>
                          </span>
                        </div>
                        <div className="og-cand-card-summary" title={meta.summary}>
                          {meta.summary}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 路径选择模式操作提示条：提示 + 已选链路（可点掉）+ 确认 */}
          {path.pathSelectionMode && (
            <div className="og-path-selection-bar">
              <span className="og-path-selection-hint">
                <Icon name="network" size={12} />
                {path.selectedPath.length > 0 &&
                path.selectedPath[path.selectedPath.length - 1]?.type === 'node'
                  ? '点选节点自动搜路径，或点选连线'
                  : '请依次点选节点和连线，构建连贯路径'}
              </span>
              <span className="og-path-selection-chain">
                {path.selectedPath.length === 0 ? (
                  <span className="og-path-chain-empty">
                    尚未选择（点击图谱中的节点开始）
                  </span>
                ) : (
                  path.selectedPath.map((step, idx) => (
                    <span key={`${step.type}_${idx}`} className="og-path-chain-seg">
                      {idx > 0 && <span className="og-path-chain-arrow">→</span>}
                      <span
                        className={`og-path-chain-item is-${step.type}${
                          idx === path.selectedPath.length - 1 ? ' is-last' : ''
                        }`}
                        onClick={
                          step.type === 'node'
                            ? () =>
                                path.removeNodeFromPath(getPathNodeKey(step.data))
                            : undefined
                        }
                        title={
                          step.type === 'node'
                            ? '点击取消该对象（其后的路径一并截断）'
                            : undefined
                        }
                      >
                        {step.type === 'node'
                          ? getPathNodeLabel(step.data)
                          : getPathEdgeLabel(step.data)}
                      </span>
                    </span>
                  ))
                )}
              </span>
              <span className="og-path-selection-actions">
                <button
                  type="button"
                  className="og-path-action-btn"
                  disabled={path.selectedPath.length === 0}
                  onClick={path.undoPathStep}
                >
                  回退
                </button>
                <button
                  type="button"
                  className="og-path-action-btn"
                  disabled={path.selectedPath.length === 0}
                  onClick={path.clearPath}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="og-path-action-btn is-confirm"
                  disabled={
                    path.selectedPath.length === 0 ||
                    path.selectedPath[path.selectedPath.length - 1].type !== 'node'
                  }
                  onClick={path.handleConfirmChain}
                >
                  查看详情
                </button>
              </span>
            </div>
          )}

          {/* 节点右键上下文菜单：靠边钳制避免溢出被裁切 */}
          {contextMenu &&
            (() => {
              const box = chartBoxRef.current;
              const maxLeft = box
                ? Math.max(0, box.clientWidth - CTX_MENU_W - 4)
                : Number.POSITIVE_INFINITY;
              const maxTop = box
                ? Math.max(0, box.clientHeight - CTX_MENU_H - 4)
                : Number.POSITIVE_INFINITY;
              return (
                <div
                  ref={ctxMenuRef}
                  className="og-context-menu"
                  style={{
                    left: Math.min(contextMenu.x + 8, maxLeft),
                    top: Math.min(contextMenu.y + 8, maxTop),
                  }}
                >
                  <div
                    className="og-context-menu-item"
                    onClick={() => {
                      const c = contextMenu.code;
                      setContextMenu(null);
                      onOpenNodeChain(c);
                    }}
                  >
                    查看对象详情
                  </div>
                  <div
                    className="og-context-menu-item"
                    onClick={() => {
                      const c = contextMenu.code;
                      setContextMenu(null);
                      onOpenInstanceGraph(c);
                    }}
                  >
                    查看实例图谱
                  </div>
                </div>
              );
            })()}
        </div>
      ) : (
        <div className="og-canvas-state">暂无图谱数据</div>
      )}
    </div>
  );
}
