const KB_BASE = '/api/kb'

/**
 * z-kb 前端 API 客户端（JS 版）。
 *
 * ── 口径说明（2026-10-22 实测，TASK-20260925-025）────────────────────────────
 * 1. **路径**：全部按 z-kb-web 7 个 controller 的真实 @RequestMapping 抄的，
 *    不是按注解「推」的。真实路由共 33 条，见
 *    `z-kb/z-kb-web/src/test/java/com/zifang/z/kb/web/KbWebAutoConfigurationTest`
 *    的 READING-KBWEB 路由 输出。
 *    注意三个 controller **没有裸根路由**：graph / ingest / modeling 的第一条就是
 *    /{workspace}/... 或 /sources、/stats、/decompose。
 * 2. **请求体字段**：宿主（z-opc）全局 Jackson 是 `PropertyNamingStrategy.SNAKE_CASE`
 *    （z-team-core/JacksonConfig），z-kb 单跑则是 camelCase。
 *    Boot 默认忽略未知属性 ⇒ 请求体**两种拼写都带**（camel + snake），
 *    两种环境都收得下；实测宿主里 `top_k` 生效、`topK` 被忽略。
 * 3. **响应字段**：宿主把 long 序列化成字符串（z-boot-jackson-starter 的
 *    longAsStringCustomizer），并把键名转成下划线。所以
 *    `document_count` / `chunk_count` / `created_at` / `count` 这些键在宿主里是
 *    下划线 + 字符串。本文件**不改响应形状**（页面按原始字段读，改了会连带把
 *    WorkspaceListPage / DocumentListPage 弄坏），需要数值时用 `toNumber()`。
 * 4. **不包信封**：z-kb 的 controller 直接返回 DTO，宿主不会给它套 Result 信封；
 *    但 z-opc 其它模块有套信封的老习惯，故这里仍保留 `data?.data ?? data` 兼容。
 */

const DEFAULT_WORKSPACE = 'default'

async function request(path, options = {}) {
    const res = await fetch(`${KB_BASE}${path}`, {
        headers: {'Content-Type': 'application/json', ...options.headers},
        ...options,
    })
    if (!res.ok) {
        let detail = ''
        try {
            const body = await res.text()
            detail = body ? ` · ${body.slice(0, 300)}` : ''
        } catch (e) {
            /* 响应体读不出来就算了，状态码已经够定位 */
        }
        throw new Error(`${res.status} ${res.statusText}${detail}`)
    }
    if (res.status === 204) return null
    const text = await res.text()
    if (!text) return null
    let data
    try {
        data = JSON.parse(text)
    } catch (e) {
        return text
    }
    return data?.data ?? data
}

/** camelCase → snake_case（只转多词键）。 */
function snake(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/** 这些键的值是**用户自己的 map**（键名任意），不许改写键名。 */
const FREE_FORM_KEYS = new Set(['frontmatter', 'metadata', 'properties', 'config'])

/**
 * 请求体归一：给每个 camelCase 键补一个 snake_case 别名。
 *
 * <p>只补别名、不删原键 —— 宿主按 snake 读、单跑按 camel 读，两边都认；
 * Boot 默认忽略未知属性 ⇒ 多带的那个键不会把请求打成 400。
 */
function wire(value, depth = 0) {
    if (Array.isArray(value)) return value.map(v => wire(v, depth))
    if (!value || typeof value !== 'object' || depth > 3) return value
    const out = {}
    for (const [k, v] of Object.entries(value)) {
        const s = snake(k)
        const child = FREE_FORM_KEYS.has(k) ? v : wire(v, depth + 1)
        out[k] = child
        if (s !== k && !(s in out)) out[s] = child
    }
    return out
}

/** long → 字符串（宿主口径）时，页面要数字就用它。 */
export function toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

export const kbApi = {
    // ── Workspaces（WorkspaceController，/api/kb/workspaces）────────────────
    listWorkspaces: () => request('/workspaces'),
    getWorkspace: (name) => request(`/workspaces/${encodeURIComponent(name)}`),
    createWorkspace: (body) => request('/workspaces', {method: 'POST', body: JSON.stringify(wire(body))}),
    getWorkspaceStats: (name) => request(`/workspaces/${encodeURIComponent(name)}/statistics`),

    // ── Documents（DocumentController，/api/kb/documents）──────────────────
    // 上游是服务端分页 (offset/limit, 默认 0/20)，总数另走 /count
    listDocuments: (workspace, offset = 0, limit = 20) =>
        request(`/documents/${encodeURIComponent(workspace)}?offset=${offset}&limit=${limit}`),
    getDocumentCount: (workspace) => request(`/documents/${encodeURIComponent(workspace)}/count`),
    getDocument: (workspace, id) =>
        request(`/documents/${encodeURIComponent(workspace)}/${encodeURIComponent(id)}`),
    deleteDocument: (workspace, id) =>
        request(`/documents/${encodeURIComponent(workspace)}/${encodeURIComponent(id)}`, {method: 'DELETE'}),
    // 建索引：body = {document:{...}, overwrite, extractGraph, workspace}
    createDocument: (body) => request('/documents', {method: 'POST', body: JSON.stringify(wire(body))}),
    batchCreateDocuments: (requests) =>
        request('/documents/batch', {method: 'POST', body: JSON.stringify(wire(requests))}),
    importMarkdown: (body) =>
        request('/documents/markdown', {method: 'POST', body: JSON.stringify(wire(body))}),
    reindexDocument: (workspace, id) =>
        request(`/documents/${encodeURIComponent(workspace)}/${encodeURIComponent(id)}/reindex`, {method: 'POST'}),
    listDocumentsByTags: (workspace, tags = [], offset = 0, limit = 20) => {
        const qs = tags.map(t => `tags=${encodeURIComponent(t)}`).join('&')
        return request(
            `/documents/${encodeURIComponent(workspace)}/by-tags?${qs}&offset=${offset}&limit=${limit}`)
    },

    // ── Search（SearchController，/api/kb/search）──────────────────────────
    // body: {query, workspace, mode(FUSION|VECTOR|KEYWORD|GRAPH|HYBRID), topK, ...}
    search: (body) => request('/search', {method: 'POST', body: JSON.stringify(wire(body))}),

    // ── Chat（ChatController，/api/kb/chat）───────────────────────────────
    chat: (body) => request('/chat', {method: 'POST', body: JSON.stringify(wire(body))}),
    createSession: (body) => request('/chat/sessions', {method: 'POST', body: JSON.stringify(wire(body))}),
    getSession: (id) => request(`/chat/sessions/${encodeURIComponent(id)}`),
    listSessions: (workspace, userId, limit = 50) => {
        const params = new URLSearchParams()
        if (workspace) params.set('workspace', workspace)
        if (userId) params.set('userId', userId)
        params.set('limit', String(limit))
        return request(`/chat/sessions?${params.toString()}`)
    },
    deleteSession: (id) => request(`/chat/sessions/${encodeURIComponent(id)}`, {method: 'DELETE'}),
    chatInSession: (id, body) =>
        request(`/chat/sessions/${encodeURIComponent(id)}/chat`, {method: 'POST', body: JSON.stringify(wire(body))}),

    // ── Graph（GraphController，/api/kb/graph）─────────────────────────────
    // 注意：graph 没有裸根路由，第一条就是 /{workspace}/entities
    listEntities: (workspace, limit = 100) =>
        request(`/graph/${encodeURIComponent(workspace)}/entities?limit=${limit}`),
    getEntity: (workspace, name) =>
        request(`/graph/${encodeURIComponent(workspace)}/entities/${encodeURIComponent(name)}`),
    getNeighbors: (workspace, name, depth = 2) =>
        request(`/graph/${encodeURIComponent(workspace)}/entities/${encodeURIComponent(name)}/neighbors?depth=${depth}`),
    // body 是实体名数组（List<String>）
    getSubgraph: (workspace, entityNames, depth = 2) =>
        request(`/graph/${encodeURIComponent(workspace)}/subgraph?depth=${depth}`, {
            method: 'POST',
            body: JSON.stringify(entityNames),
        }),

    // ── Ingest（IngestController，/api/kb/ingest）──────────────────────────
    listSources: () => request('/ingest/sources'),
    getIngestStats: () => request('/ingest/stats'),
    // 批量拉取可能很久：这里不设超时，交由浏览器/网关口径
    runIngest: (sourceId, config = {}) =>
        request(`/ingest/run?sourceId=${encodeURIComponent(sourceId)}`, {
            method: 'POST',
            body: JSON.stringify(config),
        }),
    submitIngest: (requests) =>
        request('/ingest/submit', {method: 'POST', body: JSON.stringify(wire(requests))}),
    // 通用 webhook 入口：body = {title, content, workspace, metadata}
    webhook: (payload, headers = {}) =>
        request('/ingest/webhook', {
            method: 'POST',
            headers,
            body: JSON.stringify(wire(payload)),
        }),
    flushWebhook: () => request('/ingest/webhook/flush', {method: 'POST'}),

    // ── Modeling（ModelingController，/api/kb/modeling）────────────────────
    // modeling 也没有裸根路由：/decompose 与 /cheatsheet
    decompose: (workspace = DEFAULT_WORKSPACE) =>
        request(`/modeling/decompose?workspace=${encodeURIComponent(workspace)}`),
    getCheatsheet: (workspace = DEFAULT_WORKSPACE) =>
        request(`/modeling/cheatsheet?workspace=${encodeURIComponent(workspace)}`),
    // POST 版：body = ProductModel（整份模型）
    createCheatsheet: (model) =>
        request('/modeling/cheatsheet', {method: 'POST', body: JSON.stringify(wire(model))}),
}

export {DEFAULT_WORKSPACE}
