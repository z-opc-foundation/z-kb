/**
 * G6 v5 图谱数据模型类型定义
 *
 * 统一 node/edge 的 data 字段结构，将 ECharts 的扁平数据模型
 * 转换为 G6 v5 的 { id, data, style } 三段式结构。
 */

// G6 v5 节点业务数据
export interface G6NodeData {
  /** objectCode（唯一英文标识，作为节点 id） */
  code: string;
  /** objectName（显示名） */
  name: string;
  /** 实例数（动态从 ref 读取，渲染时注入） */
  instanceCount?: number;
  /** 分类编码 */
  categoryCode?: string;
  /** 原始 ECharts 节点数据透传（label formatter 等可能需要） */
  [key: string]: any;
}

// G6 v5 节点
export interface G6Node {
  id: string;
  data: G6NodeData;
  style?: Record<string, any>;
}

// G6 v5 边业务数据
export interface G6EdgeData {
  /** edgeType（关系类型编码） */
  code: string;
  /** 显示名（relDisplayMap 映射后的中文名） */
  displayName: string;
  /** 源节点名 */
  sourceName: string;
  /** 目标节点名 */
  targetName: string;
  /** 实例数 */
  instanceCount?: number;
  /** 原始 ECharts 边数据透传 */
  [key: string]: any;
}

// G6 v5 边（source===target 时 G6 原生渲染自关联 loop edge）
export interface G6Edge {
  id: string;
  source: string;
  target: string;
  data: G6EdgeData;
  style?: Record<string, any>;
}

// 完整图谱数据
export interface GraphData {
  nodes: G6Node[];
  edges: G6Edge[];
}

// ECharts 原始数据格式（filteredGraphData 的类型）
export interface EChartsGraphData {
  data: any[];
  links: any[];
}
