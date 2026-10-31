import { request } from './http';
import { getTenantCode } from '@/utils/tenant';

/**
 * 本体图谱查询服务（z-kb 适配层）。
 *
 * 页面与类型保持 galaxy-meta OntologyBrowse 契约不变（参考实现自己的注释也预留了
 * 「仅需调整 BASE 切换到自有后端，页面与类型不变」），数据源换到 z-kb 图谱契约：
 * space → 知识库；objectTypes / relations → 由 graph queryByKb 的节点 / 边类型现推；
 * stats → 节点 / 边按类型实时计数。z-kb 图谱引擎是本地规则图谱，不支持 nGQL，
 * executeNGQLQuery 显式返回失败，页面实例查询标签页如实展示原因。
 */
const KB_BASE = '/future-brain/v1';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

const NODE_TYPE_LABELS: Record<string, string> = {
  MATERIAL: '物料',
  CONCEPT: '概念',
  WIKI: 'Wiki',
};

/* ---------- 类型 ---------- */

/** 图数据库空间信息 */
export interface SpaceInfo {
  spaceName: string;
  displayName?: string;
  description?: string;
}

/** 对象类型信息 */
export interface ObjectTypeInfo {
  typeName: string;
  displayName?: string;
  comment?: string;
  /** 业务对象分类编码（代理层注入，可能缺省） */
  categoryCode?: string;
  /** 业务对象分类名称（代理层注入，可能缺省） */
  categoryName?: string;
}

/** 属性信息 */
export interface PropertyInfo {
  propertyName: string;
  propertyType: string;
  required?: boolean;
  description?: string;
}

/** 关系类型信息 */
export interface RelationInfo {
  relationType: string;
  displayName?: string;
  comment?: string;
}

/** Space 完整元数据 */
export interface SpaceMetadata {
  spaceName: string;
  objectTypes: ObjectTypeInfo[];
  objectPropertiesMap: Record<string, PropertyInfo[]>;
  relations: RelationInfo[];
  /** Edge 属性映射（后端字段为 relationPropertiesMap） */
  relationPropertiesMap?: Record<string, PropertyInfo[]>;
}

/** Tag 关系信息（图谱边定义） */
export interface TagRelationInfo {
  sourceTag: string;
  targetTag: string;
  edgeType: string;
  description?: string;
}

/** nGQL 查询执行结果 */
export interface QueryExecutionResult {
  query: string;
  success: boolean;
  error?: string | null;
  rowCount: number;
  duration: number;
  columns?: string[] | null;
  tableData?: Array<Record<string, unknown>> | null;
}

/** 空间实例统计 */
export interface SpaceStatsResult {
  tagCounts: Record<string, number>;
  edgeCounts: Record<string, number>;
  /** yyyy-MM-dd HH:mm:ss */
  statsTime: string;
}

/** STATS 异步任务状态 */
export interface StatsJobStatus {
  /** running / finished / failed */
  status: string;
  stopTime: string;
  jobId: string;
}

/* ---------- z-kb 图谱契约 ---------- */

interface KbGraphNode {
  nodeId: string;
  nodeType: string;
  name?: string;
}

interface KbGraphEdge {
  edgeId: string;
  edgeType: string;
  sourceNodeId: string;
  targetNodeId: string;
}

interface KbGraphView {
  kbId: string;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  nodes: KbGraphNode[];
  edges: KbGraphEdge[];
}

function loadGraph(spaceName: string): Promise<KbGraphView> {
  return request<KbGraphView>(`${KB_BASE}/graph/queryByKb`, {
    method: 'get',
    params: { kbId: spaceName },
    headers: tenantHeaders(),
  });
}

function nodeTypeLabel(typeName: string): string {
  return NODE_TYPE_LABELS[typeName] || typeName;
}

function nowStamp(): string {
  const d = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ---------- 服务函数 ---------- */

/** 获取所有图数据库 Space 列表（z-kb：知识库分页） */
export async function querySpaces(): Promise<SpaceInfo[]> {
  const page = await request<{
    records: Array<{ kbId: string; name: string; description?: string }>;
  }>(`${KB_BASE}/knowledgeBase/page`, {
    method: 'post',
    data: { current: 1, size: 200 },
    headers: tenantHeaders(),
  });
  return (page?.records || []).map((item) => ({
    spaceName: item.kbId,
    displayName: item.name,
    description: item.description,
  }));
}

/** 获取指定 Space 的完整元数据（z-kb：由图谱节点 / 边类型现推） */
export async function getSpaceMetadata(spaceName: string): Promise<SpaceMetadata> {
  const graph = await loadGraph(spaceName);
  const nodeTypes: string[] = [];
  (graph.nodes || []).forEach((node) => {
    if (node.nodeType && !nodeTypes.includes(node.nodeType)) {
      nodeTypes.push(node.nodeType);
    }
  });
  const edgeTypes: string[] = [];
  (graph.edges || []).forEach((edge) => {
    if (edge.edgeType && !edgeTypes.includes(edge.edgeType)) {
      edgeTypes.push(edge.edgeType);
    }
  });
  return {
    spaceName,
    objectTypes: nodeTypes.map((typeName) => ({
      typeName,
      displayName: nodeTypeLabel(typeName),
      comment: '',
      categoryCode: '',
      categoryName: '未分类',
    })),
    objectPropertiesMap: {},
    relations: edgeTypes.map((relationType) => ({
      relationType,
      displayName: relationType,
      comment: '',
    })),
    relationPropertiesMap: {},
  };
}

/** 获取指定 Space 的 Tag-Edge 关系定义（z-kb：按边类型取首条边的两端节点类型） */
export async function queryTagRelations(spaceName: string): Promise<TagRelationInfo[]> {
  const graph = await loadGraph(spaceName);
  const typeOfNode = new Map<string, string>();
  (graph.nodes || []).forEach((node) => typeOfNode.set(node.nodeId, node.nodeType));
  const seen = new Set<string>();
  const relations: TagRelationInfo[] = [];
  (graph.edges || []).forEach((edge) => {
    if (seen.has(edge.edgeType)) return;
    const sourceTag = typeOfNode.get(edge.sourceNodeId);
    const targetTag = typeOfNode.get(edge.targetNodeId);
    if (!sourceTag || !targetTag) return;
    seen.add(edge.edgeType);
    relations.push({ sourceTag, targetTag, edgeType: edge.edgeType });
  });
  return relations;
}

/** 执行 nGQL 查询（z-kb 图谱引擎是本地规则图谱，不支持，显式失败） */
export function executeNGQLQuery(
  spaceName: string,
  nGql: string,
): Promise<QueryExecutionResult> {
  return Promise.resolve({
    query: nGql,
    success: false,
    error: 'z-kb 图谱引擎是本地规则图谱，不支持 nGQL 实例查询',
    rowCount: 0,
    duration: 0,
    columns: null,
    tableData: null,
  });
}

/** 获取实例数量与统计时间（z-kb：节点 / 边按类型实时计数） */
export async function getSpaceStats(spaceName: string): Promise<SpaceStatsResult> {
  const graph = await loadGraph(spaceName);
  const tagCounts: Record<string, number> = {};
  (graph.nodes || []).forEach((node) => {
    tagCounts[node.nodeType] = (tagCounts[node.nodeType] || 0) + 1;
  });
  const edgeCounts: Record<string, number> = {};
  (graph.edges || []).forEach((edge) => {
    edgeCounts[edge.edgeType] = (edgeCounts[edge.edgeType] || 0) + 1;
  });
  return { tagCounts, edgeCounts, statsTime: nowStamp() };
}

/** 提交 SUBMIT JOB STATS（z-kb 统计为实时计算，无刷新任务） */
export function refreshSpaceStats(
  spaceName: string,
): Promise<{ jobId: string; status: string; message?: string }> {
  return Promise.resolve({
    jobId: `zkb-realtime-${spaceName}`,
    status: 'finished',
    message: 'z-kb 图谱统计为实时计算，无需刷新任务',
  });
}

/** 获取最新 STATS 任务状态与完成时间 */
export function getStatsJobStatus(spaceName: string): Promise<StatsJobStatus> {
  return Promise.resolve({
    status: 'finished',
    stopTime: nowStamp(),
    jobId: `zkb-realtime-${spaceName}`,
  });
}
