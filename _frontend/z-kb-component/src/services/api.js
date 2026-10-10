const KB_BASE = '/api/kb'

async function request(path, options = {}) {
    const res = await fetch(`${KB_BASE}${path}`, {
        headers: {'Content-Type': 'application/json', ...options.headers},
        ...options,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const data = await res.json()
    return data?.data ?? data
}

export const kbApi = {
    // Workspaces
    listWorkspaces: () => request('/workspaces'),
    getWorkspace: (name) => request(`/workspaces/${name}`),
    createWorkspace: (body) => request('/workspaces', {method: 'POST', body: JSON.stringify(body)}),
    getWorkspaceStats: (name) => request(`/workspaces/${name}/statistics`),

    // Documents —— 上游是服务端分页 (offset/limit, 默认 0/20)，总数另走 /count
    listDocuments: (workspace, offset = 0, limit = 20) =>
        request(`/documents/${workspace}?offset=${offset}&limit=${limit}`),
    getDocumentCount: (workspace) => request(`/documents/${workspace}/count`),
    deleteDocument: (workspace, id) => request(`/documents/${workspace}/${id}`, {method: 'DELETE'}),

    // Search
    search: (body) => request('/search', {method: 'POST', body: JSON.stringify(body)}),

    // Chat
    chat: (body) => request('/chat', {method: 'POST', body: JSON.stringify(body)}),
    listSessions: () => request('/chat/sessions'),
    deleteSession: (id) => request(`/chat/sessions/${id}`, {method: 'DELETE'}),

    // Graph
    listEntities: (workspace) => request(`/graph/${workspace}/entities`),

    // Ingest
    listSources: () => request('/ingest/sources'),
    getIngestStats: () => request('/ingest/stats'),
}
