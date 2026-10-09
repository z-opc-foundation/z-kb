import axios from 'axios'
import type {
  Document, ImportResult, SearchQuery, SearchResult,
  Entity, GraphQueryResult, Workspace, KBStatistics,
  ChatSession, ChatResponse
} from '../types'

const api = axios.create({
  baseURL: '/api/kb',
  timeout: 30000,
})

/** 慢请求实例（建模/大批量 ingest 用），放宽到 5 分钟 */
const slowApi = axios.create({
  baseURL: '/api/kb',
  timeout: 300000,
})

const DEFAULT_WORKSPACE = 'default'

export const DocAPI = {
  index: (req: { document: Document; overwrite?: boolean; extractGraph?: boolean; workspace?: string }) =>
    api.post<ImportResult>('/documents', req).then(r => r.data),

  importMarkdown: (req: { workspace?: string; title?: string; content: string; tags?: string[]; author?: string }) =>
    api.post<ImportResult>('/documents/markdown', req).then(r => r.data),

  get: (workspace: string, id: string) =>
    api.get<Document>(`/documents/${workspace}/${id}`).then(r => r.data),

  delete: (workspace: string, id: string) =>
    api.delete<boolean>(`/documents/${workspace}/${id}`).then(r => r.data),

  list: (workspace: string, offset = 0, limit = 50) =>
    api.get<Document[]>(`/documents/${workspace}`, { params: { offset, limit } }).then(r => r.data),

  reindex: (workspace: string, id: string) =>
    api.post<ImportResult>(`/documents/${workspace}/${id}/reindex`).then(r => r.data),

  count: (workspace: string) =>
    api.get<{ count: number }>(`/documents/${workspace}/count`).then(r => r.data),
}

export const SearchAPI = {
  search: (req: SearchQuery): Promise<SearchResult> =>
    api.post<SearchResult>('/search', req).then(r => r.data),
}

export const GraphAPI = {
  listEntities: (workspace: string, limit = 100): Promise<Entity[]> =>
    api.get<Entity[]>(`/graph/${workspace}/entities`, { params: { limit } }).then(r => r.data),

  getEntity: (workspace: string, name: string): Promise<Entity> =>
    api.get<Entity>(`/graph/${workspace}/entities/${encodeURIComponent(name)}`).then(r => r.data),

  getNeighbors: (workspace: string, name: string, depth = 2): Promise<Entity[]> =>
    api.get<Entity[]>(`/graph/${workspace}/entities/${encodeURIComponent(name)}/neighbors`, { params: { depth } }).then(r => r.data),

  getSubgraph: (workspace: string, names: string[], depth = 2): Promise<GraphQueryResult> =>
    api.post<GraphQueryResult>(`/graph/${workspace}/subgraph?depth=${depth}`, names).then(r => r.data),
}

export const WorkspaceAPI = {
  list: (): Promise<Workspace[]> =>
    api.get<Workspace[]>('/workspaces').then(r => r.data),

  create: (name: string, description?: string): Promise<Workspace> =>
    api.post<Workspace>('/workspaces', { name, description }).then(r => r.data),

  statistics: (name: string): Promise<KBStatistics> =>
    api.get<KBStatistics>(`/workspaces/${name}/statistics`).then(r => r.data),
}

export const ChatAPI = {
  createSession: (workspace: string, title: string): Promise<ChatSession> =>
    api.post<ChatSession>('/chat/sessions', { workspace, title }).then(r => r.data),

  listSessions: (workspace: string): Promise<ChatSession[]> =>
    api.get<ChatSession[]>('/chat/sessions', { params: { workspace } }).then(r => r.data),

  getSession: (id: string): Promise<ChatSession> =>
    api.get<ChatSession>(`/chat/sessions/${id}`).then(r => r.data),

  deleteSession: (id: string) =>
    api.delete<boolean>(`/chat/sessions/${id}`).then(r => r.data),

  chat: (req: { question: string; workspace?: string; sessionId?: string; topK?: number }): Promise<ChatResponse> =>
    api.post<ChatResponse>('/chat', req).then(r => r.data),

  chatInSession: (sessionId: string, question: string): Promise<ChatResponse> =>
    api.post<ChatResponse>(`/chat/sessions/${sessionId}/chat`, { question }).then(r => r.data),
}

export const IngestAPI = {
  listSources: (): Promise<{ sources: Array<{ sourceId: string; type: string; label: string; enabled: boolean }>; supportedTypes: Array<{ name: string; label: string }> }> =>
    api.get('/ingest/sources').then(r => r.data),

  // 大批量接入可能耗时较长（数千文档），用慢请求实例避免超时
  run: (sourceId: string, config: Record<string, any>) =>
    slowApi.post(`/ingest/run?sourceId=${sourceId}`, config).then(r => r.data),

  submit: (requests: any[]) =>
    slowApi.post('/ingest/submit', requests).then(r => r.data),

  webhook: (payload: { title: string; content: string; workspace?: string; metadata?: Record<string, any> }) =>
    api.post('/ingest/webhook', payload).then(r => r.data),

  flushWebhook: () =>
    slowApi.post('/ingest/webhook/flush').then(r => r.data),

  stats: () =>
    api.get('/ingest/stats').then(r => r.data),
}

export const ModelingAPI = {
  // 拆解工作台（小抄生成可能耗时 1-3 分钟，用慢请求实例避免超时）
  decompose: (workspace: string) =>
    slowApi.get(`/modeling/decompose?workspace=${workspace}`).then(r => r.data),

  cheatsheet: (workspace: string) =>
    slowApi.get(`/modeling/cheatsheet?workspace=${workspace}`).then(r => r.data),
}

export { DEFAULT_WORKSPACE }
