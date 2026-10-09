export {DocAPI, SearchAPI, GraphAPI, WorkspaceAPI, ChatAPI, IngestAPI, ModelingAPI} from './***REMOVED***/services/api'
export function configure***REMOVED***(config) {
    if (config && config.apiBase !== undefined) {
        // api 实例未从 api.ts 导出（模块内私有），apiBase 走 suit 的 vite 代理配置
    }
}
