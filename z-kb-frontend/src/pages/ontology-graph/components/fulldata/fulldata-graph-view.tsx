/**
 * 实例数据图谱视图（FulldataGraphView）：自 galaxy-meta ontology-fulldata-graph.tsx 平移。
 *
 * 以 G6 力导向图渲染表格实例数据：每一个对象顶点（VID）成为一个节点，
 * 关系查询模式下相邻对象之间的真实路径成为一条有向边。
 *
 * 数据口径与表格视图（FulldataView）保持一致：
 * - 行数据 key 形如 `${objectCode}_${propName}`；顶点 ID 列形如 `${objectCode}__vertexId`；
 * - 链路顺序由 chainNodes（对象 code 序列）给出，chainEdges[i] 描述
 *   chainNodes[i] → chainNodes[i + 1] 之间的关系；
 * - 自关联等重复出现的对象按链路位置取列（首次出现无下标，重复出现带下标）。
 */
import { useG6Graph, toInstanceG6Data } from '@/components/ontology-graph';
import type { GraphData } from '@/components/ontology-graph';
import type { SpaceMetadata } from '@/services/ontology-graph';
import { useEffect, useMemo } from 'react';
import type {
  ChainEdge,
  FulldataGraphSnapshot,
  OntologyObjectInfo,
  TableRow,
} from '../../types';
import '../../fulldata.less';

/** 图谱最大节点数：超过则截断，避免大数据量下力导向布局卡死 */
const MAX_GRAPH_NODES = 500;

/** 顶点 ID 列后缀：与查询语句沉列口径一致（`${code}__vertexId`） */
const VERTEX_ID_SUFFIX = '__vertexId';

/**
 * 解析某行中指定对象的顶点唯一标识（VID）。
 * 取值优先级：`${code}_vid` → `${code}__vertexId` → 首个属性列值。
 * 全部缺失时返回空串（该对象在此行无实例，不生成节点）。
 */
function resolveVid(row: TableRow, code: string, firstProp: string): string {
  const direct = row[`${code}_vid`];
  if (direct != null && String(direct) !== '') return String(direct);
  const vertexId = row[`${code}${VERTEX_ID_SUFFIX}`];
  if (vertexId != null && String(vertexId) !== '') return String(vertexId);
  if (firstProp) {
    const propVal = row[`${code}_${firstProp}`];
    if (propVal != null && String(propVal) !== '') return String(propVal);
  }
  return '';
}

/**
 * 解析某行中链路指定位置（step）的顶点唯一标识。
 * 重复出现的对象（自关联等场景）取带链路位置下标的列
 * （`_vid_${step}` / `__vertexId_${step}` / `_${prop}_${step}`）。
 * 若对重复位置仍取无下标列，会拿到首次出现端的实例，
 * 自关联边两端同值，被自环排除逻辑误杀而不渲染。
 */
function resolveVidAt(
  row: TableRow,
  code: string,
  step: number,
  firstProp: string,
  isRepeat: boolean,
): string {
  if (!isRepeat) return resolveVid(row, code, firstProp);
  const direct = row[`${code}_vid_${step}`];
  if (direct != null && String(direct) !== '') return String(direct);
  const vertexId = row[`${code}${VERTEX_ID_SUFFIX}_${step}`];
  if (vertexId != null && String(vertexId) !== '') return String(vertexId);
  if (firstProp) {
    const propVal = row[`${code}_${firstProp}_${step}`];
    if (propVal != null && String(propVal) !== '') return String(propVal);
  }
  return '';
}

/** 取对象在 objectPropertiesMap 中的属性英文名列表 */
function getPropNames(metadata: SpaceMetadata | null, code: string): string[] {
  const defs = metadata?.objectPropertiesMap?.[code];
  return Array.isArray(defs)
    ? defs.map((p) => String(p?.propertyName ?? '')).filter(Boolean)
    : [];
}

/**
 * 拼接节点的属性摘要，用于 tooltip 展示：`prop: value | prop: value`。
 * 只取有值的属性，最多 6 项。重复出现的对象取带链路位置下标的列。
 */
function buildPropsSummary(
  row: TableRow,
  metadata: SpaceMetadata | null,
  code: string,
  step: number,
  isRepeat: boolean,
): string {
  const parts: string[] = [];
  getPropNames(metadata, code).forEach((pName) => {
    const key = isRepeat ? `${code}_${pName}_${step}` : `${code}_${pName}`;
    const val = row[key];
    if (val != null && String(val) !== '') parts.push(`${pName}: ${val}`);
  });
  return parts.slice(0, 6).join(' | ');
}

/**
 * 由行数据 + 链路信息生成力导向图的节点 / 边 / 分类。
 * totalNodeCount 为截断前的真实节点数，供大图提示条展示。
 */
export function toGraphSnapshotData(
  rowData: TableRow[],
  chainNodes: string[],
  chainEdges: ChainEdge[],
  objects: OntologyObjectInfo[],
  metadata: SpaceMetadata | null,
): { data: GraphData; totalNodeCount: number } {
  const objMap = new Map<string, OntologyObjectInfo>();
  (objects || []).forEach((o) => {
    if (o?.objectCode) objMap.set(String(o.objectCode), o);
  });

  // 保序去重得到唯一对象 code，每个 code 对应一个分类（分色）
  const uniqueCodes: string[] = [];
  chainNodes.forEach((c) => {
    if (c && !uniqueCodes.includes(c)) uniqueCodes.push(c);
  });
  const categoryNames = uniqueCodes.map(
    (code) => String(objMap.get(code)?.objectName ?? code),
  );

  // 每个对象的首个属性列名（供 resolveVid 兜底），惰性缓存
  const firstPropCache = new Map<string, string>();
  const firstPropOf = (code: string): string => {
    if (firstPropCache.has(code)) return firstPropCache.get(code) as string;
    const name = getPropNames(metadata, code)[0] ?? '';
    firstPropCache.set(code, name);
    return name;
  };

  // 预计算每个链路位置是否为该对象的重复出现（与查询语句的列名口径一致）
  const repeatAt: boolean[] = [];
  const seenCodes = new Set<string>();
  chainNodes.forEach((code) => {
    repeatAt.push(seenCodes.has(code));
    seenCodes.add(code);
  });

  // 按链路位置遍历而非按去重对象：自关联等重复出现的对象两端各有一套列，
  // 每个位置的实例都要生成节点
  const nodeMap = new Map<string, { code: string; vid: string; props: string; category: number }>();
  chainNodes.forEach((code, step) => {
    const category = uniqueCodes.indexOf(code);
    const isRepeat = repeatAt[step];
    (rowData || []).forEach((row) => {
      const vid = resolveVidAt(row, code, step, firstPropOf(code), isRepeat);
      if (!vid) return;
      const id = `${code}::${vid}`;
      if (nodeMap.has(id)) return;
      nodeMap.set(id, {
        code,
        vid,
        category: category < 0 ? 0 : category,
        props: buildPropsSummary(row, metadata, code, step, isRepeat),
      });
    });
  });

  // 边提取（仅关系查询结果有链路关系时）
  const linkSeen = new Set<string>();
  const edges: Array<{ source: string; target: string; label: string }> = [];
  if (chainNodes.length > 1 && (chainEdges || []).length > 0) {
    (rowData || []).forEach((row) => {
      for (let i = 0; i < chainNodes.length - 1; i += 1) {
        const sourceCode = chainNodes[i];
        const targetCode = chainNodes[i + 1];
        const sourceVid = resolveVidAt(
          row,
          sourceCode,
          i,
          firstPropOf(sourceCode),
          repeatAt[i],
        );
        const targetVid = resolveVidAt(
          row,
          targetCode,
          i + 1,
          firstPropOf(targetCode),
          repeatAt[i + 1],
        );
        if (!sourceVid || !targetVid) continue;
        // 仅排除同一实例指向自身的真正自环（实例指向自身无业务意义）；
        // 自关联边在实例层是同类型不同实例间的关系，两端 VID 不同，正常生成边
        if (sourceVid === targetVid && sourceCode === targetCode) continue;
        const source = `${sourceCode}::${sourceVid}`;
        const target = `${targetCode}::${targetVid}`;
        const label = String(chainEdges[i]?.label ?? '');
        const key = `${source}->${target}::${label}`;
        if (linkSeen.has(key)) continue;
        linkSeen.add(key);
        edges.push({ source, target, label });
      }
    });
  }

  // 性能保护：节点超限则截断，边同步过滤
  const allNodes = Array.from(nodeMap.entries());
  const total = allNodes.length;
  const keptNodes = allNodes.slice(0, MAX_GRAPH_NODES);
  const keptIds = new Set(keptNodes.map(([id]) => id));
  const keptLinks = edges.filter(
    (l) => keptIds.has(l.source) && keptIds.has(l.target),
  );

  // 按度数设置节点大小
  const degreeMap = new Map<string, number>();
  keptLinks.forEach((l) => {
    degreeMap.set(l.source, (degreeMap.get(l.source) ?? 0) + 1);
    degreeMap.set(l.target, (degreeMap.get(l.target) ?? 0) + 1);
  });

  return {
    data: toInstanceG6Data(
      keptNodes.map(([id, n]) => ({
        id,
        name: n.vid,
        objectCode: n.code,
        objectName: String(objMap.get(n.code)?.objectName ?? n.code),
        category: n.category,
        props: n.props,
        value: degreeMap.get(id) ?? 0,
      })),
      keptLinks,
      categoryNames.map((name) => ({ name })),
    ),
    totalNodeCount: total,
  };
}

export function FulldataGraphView(props: { snapshot: FulldataGraphSnapshot }) {
  const { rowData, chainNodes, chainEdges, objects, metadata } = props.snapshot;

  const { data, totalNodeCount } = useMemo(
    () => toGraphSnapshotData(rowData, chainNodes, chainEdges, objects, metadata),
    [rowData, chainNodes, chainEdges, objects, metadata],
  );

  const graphApi = useG6Graph({
    zoomRange: [0.3, 5],
    tooltipFormatter: (nodeData, type) => {
      if (type === 'node') {
        const color = nodeData.fillColor || '#1f8bff';
        const propsHtml = nodeData.props
          ? `<div style="margin-top:6px;font-size:11px;color:#888;line-height:1.7">${nodeData.props
              .split(' | ')
              .map((p: string) => `<div>• ${p}</div>`)
              .join('')}</div>`
          : '';
        return `<div style="max-width:260px">
          <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;color:#fff;background:${color}">${nodeData.objectName}</span>
          <div style="margin-top:6px;font-size:13px;font-weight:600;color:#222">${nodeData.name}</div>
          ${propsHtml}
        </div>`;
      }
      return `<span style="font-size:11px;color:#555">${nodeData.label || ''}</span>`;
    },
  });

  const graphApiReady = graphApi.ready;
  const graphApiSetData = graphApi.setData;
  useEffect(() => {
    if (data.nodes.length === 0) return;
    if (!graphApiReady) return;
    graphApiSetData(data);
  }, [data, graphApiReady, graphApiSetData]);

  if ((rowData || []).length === 0) {
    return (
      <div className="lc-fd-graph-wrap lc-fd-graph-empty">
        <div className="lc-fd-graph-empty-title">暂无实例数据</div>
        <div className="lc-fd-graph-empty-desc">
          勾选对象属性并执行查询后，实例将以力导向图谱形式呈现
        </div>
      </div>
    );
  }

  const isLargeGraph = totalNodeCount > MAX_GRAPH_NODES;

  return (
    <div className="lc-fd-graph-wrap">
      {isLargeGraph && (
        <div className="lc-fd-graph-tip">
          数据量较大（共 {totalNodeCount} 个节点），当前展示前 {MAX_GRAPH_NODES} 个节点
        </div>
      )}
      {chainEdges.length === 0 && (
        <div className="lc-fd-graph-tip">
          当前为独立查询模式，切换至关系查询可查看实例间关系连接
        </div>
      )}
      <div
        ref={graphApi.containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default FulldataGraphView;
