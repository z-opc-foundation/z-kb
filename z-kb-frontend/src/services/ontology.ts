import { request } from '@/services/http';
import type { PageResult } from '@/services/knowledgeBase';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type OntologyStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';

export type StructureStatus = 'ACTIVE' | 'RETIRED';

export type StructureSource = 'DIALOG' | 'IMPORT' | 'MANUAL';

export interface OntologyDetail {
  code: string;
  name: string;
  description?: string;
  graphSpace?: string;
  schemaVersion?: string;
  status: OntologyStatus;
  tagCount?: number;
  edgeCount?: number;
  graphBound: boolean;
}

export interface OntologyTagRecord {
  code: string;
  tagName: string;
  displayName?: string;
  category?: string;
  bizDomain?: string;
  levelCode?: string;
  extractable?: number;
  status: StructureStatus;
  sourceType?: StructureSource;
  description?: string;
  instanceCount?: string;
}

export interface OntologyEndpointRecord {
  code: string;
  edgeCode: string;
  srcTag?: string;
  dstTag?: string;
  sourceField?: string;
  targetField?: string;
  displayName?: string;
  extractable?: number;
  status: StructureStatus;
  selfLoop: boolean;
}

export interface OntologyEdgeRecord {
  code: string;
  edgeName: string;
  displayName?: string;
  constraintMode?: string;
  bizDomain?: string;
  status: StructureStatus;
  sourceType?: StructureSource;
  description?: string;
  edgeCount?: string;
  endpoints: OntologyEndpointRecord[];
}

export interface OntologyPropertyRecord {
  code: string;
  ownerType: 'TAG' | 'EDGE';
  ownerName: string;
  propertyName: string;
  displayName?: string;
  dataType: string;
  nullable?: number;
  defaultValue?: string;
  seqNo?: number;
  status: StructureStatus;
  description?: string;
}

export interface OntologyTagDetail extends OntologyTagRecord {
  properties: OntologyPropertyRecord[];
}

export interface OntologyEdgeDetail extends OntologyEdgeRecord {
  properties: OntologyPropertyRecord[];
}

export interface OntologyGraphNode {
  code: string;
  tagName: string;
  displayName?: string;
  category?: string;
  bizDomain?: string;
  levelCode?: string;
  instanceCount?: string;
}

export interface OntologyGraphEdge {
  code: string;
  edgeName: string;
  displayName?: string;
  srcTag?: string;
  dstTag?: string;
  selfLoop: boolean;
  endpointName?: string;
}

export interface OntologyGraphView {
  ontologyCode: string;
  nodeCount: string;
  edgeCount: string;
  truncated: boolean;
  nodes: OntologyGraphNode[];
  edges: OntologyGraphEdge[];
}

export interface OntologyTagPageQuery {
  current?: number;
  size?: number;
  status?: string;
  category?: string;
  keyword?: string;
}

export interface OntologyEdgePageQuery {
  current?: number;
  size?: number;
  status?: string;
  bizDomain?: string;
  keyword?: string;
}

export interface OntologySavePayload {
  name: string;
  description?: string;
}

export interface OntologyTagCategory {
  code: string;
  categoryName: string;
  sortOrder?: number;
  description?: string;
  tagCount?: string;
}

export interface OntologyTagCategorySavePayload {
  categoryName: string;
  description?: string;
}

export interface OntologyTagCategoryUpdatePayload extends OntologyTagCategorySavePayload {
  code: string;
}

export interface OntologyTagCategoryBindPayload {
  tagCode: string;
  categoryCode?: string;
}

export interface OntologyInstanceQuery {
  tagName: string;
  keyword?: string;
  current?: number;
  size?: number;
}

export interface OntologyInstanceRecord {
  vid: string;
  name?: string;
  properties?: Record<string, unknown>;
}

export interface OntologyInstancePage {
  records: OntologyInstanceRecord[];
  total: number;
  current: number;
  size: number;
  /** 图库是否已接入；false 时空页，属正常降级态而非错误。 */
  graphBound: boolean;
}

/** 本体不存在（未开通）业务错误码 */
export const ONTOLOGY_NOT_OPEN_CODE = 51001;

const BASE = '/future-brain/v1/ontology';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

// 后端把分页字段按 Long 序列化为字符串，边界处转回数字，避免调用方出现 "1"+1="11" 拼接
function normalizePageMeta<
  T extends { total: number; current: number; size: number },
>(page: T): T {
  return {
    ...page,
    total: Number(page.total),
    current: Number(page.current),
    size: Number(page.size),
  };
}

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

/**
 * 本体详情：null 表示未开通（51001，正常业务态）；undefined 表示加载失败。
 *
 * z-kb 适配：z-kb 没有租户级本体与图空间绑定，图谱空间即知识库，取最近更新的
 * 一个知识库推导出详情（形状不变，页面与交互不动）；没有知识库时视同未开通。
 */
export async function getOntologyDetail(): Promise<
  OntologyDetail | null | undefined
> {
  try {
    const page = await request<
      PageResult<{
        kbId: string;
        code: string;
        name: string;
        description?: string;
      }>
    >('/future-brain/v1/knowledgeBase/page', {
      method: 'post',
      data: { current: 1, size: 1 },
      headers: tenantHeaders(),
      silent: true,
    });
    const first = page.records[0];
    if (!first) {
      return null;
    }
    return {
      code: first.code,
      name: first.name,
      description: first.description,
      graphSpace: first.kbId,
      status: 'ACTIVE',
      graphBound: true,
    };
  } catch (error) {
    toast('本体信息加载失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function createOntology(data: OntologySavePayload) {
  return call(() =>
    request<OntologyDetail>(`${BASE}/create`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function updateOntology(data: OntologySavePayload) {
  return call(() =>
    request<OntologyDetail>(`${BASE}/update`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function pageOntologyTags(data: OntologyTagPageQuery) {
  return call(() =>
    request<PageResult<OntologyTagRecord>>(`${BASE}/schema/tag/list`, {
      method: 'get',
      params: data,
      headers: tenantHeaders(),
    }),
  );
}

export function pageOntologyEdges(data: OntologyEdgePageQuery) {
  return call(() =>
    request<PageResult<OntologyEdgeRecord>>(`${BASE}/schema/edge/list`, {
      method: 'get',
      params: data,
      headers: tenantHeaders(),
    }),
  );
}

export function getOntologyTagDetail(code: string) {
  return call(() =>
    request<OntologyTagDetail>(`${BASE}/schema/tag/detail`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function getOntologyEdgeDetail(code: string) {
  return call(() =>
    request<OntologyEdgeDetail>(`${BASE}/schema/edge/detail`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function getOntologyGraphView() {
  return call(() =>
    request<OntologyGraphView>(`${BASE}/schema/graph/view`, {
      method: 'get',
      headers: tenantHeaders(),
    }),
  );
}

/** 对象类型分类列表；返回 undefined 表示加载失败。 */
export function listOntologyTagCategories() {
  return call(() =>
    request<OntologyTagCategory[]>(`${BASE}/schema/tag-category/list`, {
      method: 'get',
      headers: tenantHeaders(),
    }),
  );
}

export function createOntologyTagCategory(data: OntologyTagCategorySavePayload) {
  return call(() =>
    request<OntologyTagCategory>(`${BASE}/schema/tag-category/create`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function updateOntologyTagCategory(data: OntologyTagCategoryUpdatePayload) {
  return call(() =>
    request<OntologyTagCategory>(`${BASE}/schema/tag-category/update`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function deleteOntologyTagCategory(code: string) {
  return call(() =>
    request<void>(`${BASE}/schema/tag-category/delete`, {
      method: 'post',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function reorderOntologyTagCategories(orderedCodes: string[]) {
  return call(() =>
    request<void>(`${BASE}/schema/tag-category/reorder`, {
      method: 'post',
      data: { orderedCodes },
      headers: tenantHeaders(),
    }),
  );
}

/** 对象类型归类；categoryCode 为空表示解绑归入「未分类」。 */
export function bindOntologyTagCategory(data: OntologyTagCategoryBindPayload) {
  return call(() =>
    request<void>(`${BASE}/schema/tag-category/bind`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

/** 按对象类型分页查图库实例；graphBound=false 表示图库未接入的降级态。 */
export function pageOntologyInstances(data: OntologyInstanceQuery) {
  return call(() =>
    request<OntologyInstancePage>(`${BASE}/schema/instance/page`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  ).then((page) => (page ? normalizePageMeta(page) : page));
}

export interface OntologyInstanceLinkQuery {
  /** 关系类型名（物理结构名，同 graph/view 边的 edgeName）。 */
  edgeName: string;
  /** 源端点约束（对象类型名），空=不限。 */
  srcTag?: string;
  /** 目标端点约束（对象类型名），空=不限；与 srcTag 相同表示自环查询。 */
  dstTag?: string;
  current?: number;
  size?: number;
}

export interface OntologyInstanceLinkRecord {
  srcVid: string;
  srcName?: string;
  dstVid: string;
  dstName?: string;
  edgeProperties?: Record<string, unknown>;
}

export interface OntologyInstanceLinkPage {
  records: OntologyInstanceLinkRecord[];
  total: number;
  current: number;
  size: number;
  /** 图库是否已接入；false 时空页，属正常降级态而非错误。 */
  graphBound: boolean;
}

export interface OntologySubgraphQuery {
  /** 对象类型名集合（物理结构名），1~5 个。 */
  tagNames: string[];
  /** 可选：关系类型名过滤；非空时只查这些关系类型的实例边（端点对不受 tagNames 包含约束）。 */
  edgeNames?: string[];
  /** 聚合边数截断上限，默认 500，上限 1000。 */
  limit?: number;
}

export interface OntologySubgraphNode {
  vid: string;
  name?: string;
  tag: string;
}

export interface OntologySubgraphEdge {
  edgeName: string;
  srcVid: string;
  dstVid: string;
  properties?: Record<string, unknown>;
}

export interface OntologySubgraphView {
  nodes: OntologySubgraphNode[];
  edges: OntologySubgraphEdge[];
  /** 聚合边数达到截断上限时为 true。 */
  truncated: boolean;
  /** 图库是否已接入；false 时空结果，属正常降级态而非错误。 */
  graphBound: boolean;
}

/** 分页查单跳实例边（自环 = srcTag 与 dstTag 相同）；graphBound=false 表示图库未接入的降级态。 */
export function pageOntologyInstanceLinks(data: OntologyInstanceLinkQuery) {
  return call(() =>
    request<OntologyInstanceLinkPage>(`${BASE}/schema/instance/link`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  ).then((page) => (page ? normalizePageMeta(page) : page));
}

/** 查类型集合内部的实例子图；graphBound=false 表示图库未接入的降级态。 */
export function queryOntologySubgraph(data: OntologySubgraphQuery) {
  return call(() =>
    request<OntologySubgraphView>(`${BASE}/schema/instance/subgraph`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}
