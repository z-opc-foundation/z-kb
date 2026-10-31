import type { SpaceMetadata } from '@/services/ontology-graph';

/** 对象层图谱节点（id 即 objectCode，name 为中文显示名） */
export interface GraphNodeItem {
  id: string;
  name: string;
  code: string;
  categoryCode: string;
}

/** 对象层图谱边（source/target 为对象 code，code/value 为关系类型） */
export interface GraphLinkItem {
  source: string;
  target: string;
  value: string;
  code: string;
  displayName: string;
  sourceName: string;
  targetName: string;
}

/** 路径选择中的一个步骤：节点或连线 */
export interface PathStep {
  type: 'node' | 'edge';
  data: GraphNodeItem | GraphLinkItem;
}

/** 链路关系边：chainEdges[i] 描述 chainNodes[i] → chainNodes[i + 1] 的关系 */
export interface ChainEdge {
  edgeType: string;
  label: string;
  forward: boolean;
  source: string;
  target: string;
}

/** 链路中去重后的对象元信息（含 8 色循环配色下标） */
export interface ChainObjectMeta {
  code: string;
  name: string;
  colorIndex: number;
}

/** 归一化后的对象属性定义 */
export interface NormalizedProperty {
  name: string;
  type: string;
  description: string;
}

/** 页面内统一的对象信息（对象清单、列定义等共用） */
export interface OntologyObjectInfo {
  objectCode: string;
  objectName: string;
  categoryCode: string;
  categoryName: string;
  description: string;
  properties: NormalizedProperty[];
}

/** 表格行数据：key 为 `${objectCode}_${propName}` 或顶点 ID 列 */
export type TableRow = Record<string, string>;

/** 查询模式：独立查询（各对象并行）/ 关系查询（沿链路一次 MATCH） */
export type QueryMode = 'independent' | 'relation';

/** 页面标签页 */
export interface GraphTabItem {
  key: string;
  label: string;
  /** overview：对象层图谱；logic-chain：路径生成的实例数据详情；fulldata-graph：单对象实例数据图谱 */
  type: 'overview' | 'logic-chain' | 'fulldata-graph';
  closable: boolean;
  /** fulldata-graph 标签页对应的对象编码（去重复用） */
  targetCode?: string;
  pathData?: PathStep[];
  graphDataKey?: string;
}

/** fulldata-graph 标签页的数据快照（存 ref，避免大数组入 state） */
export interface FulldataGraphSnapshot {
  rowData: TableRow[];
  chainNodes: string[];
  chainEdges: ChainEdge[];
  objects: OntologyObjectInfo[];
  metadata: SpaceMetadata | null;
}
