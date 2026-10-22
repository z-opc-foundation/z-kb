import {useEffect, useState} from 'react'
import {Card, Input, Button, Select, InputNumber, List, Tag, Alert, Space} from 'antd'
import {SearchOutlined} from '@ant-design/icons'
import {EmptyState, ErrorState, LoadingState} from '@yuku123/z-frontend-common/ui'
import {kbApi} from '../services/api'

const {TextArea} = Input

// SearchMode 枚举，逐一对应 z-kb-api/src/.../SearchMode.java
const MODES = [
    {value: 'FUSION', label: 'FUSION（向量+关键词+图谱，RRF）'},
    {value: 'HYBRID', label: 'HYBRID（向量+关键词）'},
    {value: 'KEYWORD', label: 'KEYWORD（仅 BM25）'},
    {value: 'VECTOR', label: 'VECTOR（仅向量）'},
    {value: 'GRAPH', label: 'GRAPH（仅图谱）'},
]

const num = v => (v === null || v === undefined || v === '' ? null : Number(v))

const hitTitle = hit => hit.context_title
    || (Array.isArray(hit.heading_path) && hit.heading_path.length ? hit.heading_path.join(' > ') : null)
    || hit.document_id

export default function SearchPage() {
    const [workspaces, setWorkspaces] = useState([])
    const [workspace, setWorkspace] = useState('default')
    const [query, setQuery] = useState('')
    const [mode, setMode] = useState('FUSION')
    const [topK, setTopK] = useState(10)
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        kbApi.listWorkspaces().then(data => {
            const list = Array.isArray(data) ? data : []
            setWorkspaces(list.map(w => ({label: w.name, value: w.name})))
            if (list.length > 0) setWorkspace(list[0].name)
        }).catch(e => setError(e.message))
    }, [])

    const doSearch = async () => {
        const q = query.trim()
        if (!q) return
        setLoading(true)
        setError(null)
        try {
            // 请求体走全局 SNAKE_CASE：实测 top_k 生效、topK 被忽略（用 topK 时恒为服务端默认 10）
            const data = await kbApi.search({query: q, workspace, mode, top_k: topK})
            setResult(data && typeof data === 'object' ? data : null)
        } catch (e) {
            setError(e.message)
            setResult(null)
        } finally {
            setLoading(false)
        }
    }

    const hits = Array.isArray(result?.hits) ? result.hits : []
    const stats = result?.stats || {}
    const entities = Array.isArray(result?.matched_entities) ? result.matched_entities : []
    const vectorBlind = ['FUSION', 'HYBRID', 'VECTOR'].includes(mode) && num(stats.vector) === 0

    /**
     * 错误态的「重试」：列表加载失败与检索失败共用一个 error state，
     * 所以重试要把两条链路都重跑一遍 —— 只重跑检索的话，
     * 工作空间列表的失败会一直挂着红条。
     */
    const retry = () => {
        setError(null)
        kbApi.listWorkspaces()
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setWorkspaces(list.map(w => ({label: w.name, value: w.name})))
                if (list.length > 0) setWorkspace(list[0].name)
            })
            .catch(e => setError(e.message))
        if (query.trim()) doSearch()
    }

    return (
        <Card title="知识库检索">
            <div style={{display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap'}}>
                <Select
                    value={workspace}
                    onChange={setWorkspace}
                    style={{width: 160}}
                    options={workspaces.length > 0 ? workspaces : [{label: 'default', value: 'default'}]}
                />
                <TextArea
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="输入搜索关键词..."
                    autoSize={{minRows: 1, maxRows: 3}}
                    style={{flex: 1, minWidth: 240}}
                    onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); doSearch() } }}
                />
                <Select value={mode} onChange={setMode} style={{width: 260}} options={MODES}/>
                <InputNumber
                    value={topK}
                    onChange={v => setTopK(v ?? 10)}
                    min={1} max={100} addonBefore="条数"
                    style={{width: 130}}
                />
                <Button type="primary" icon={<SearchOutlined/>} loading={loading} onClick={doSearch}>
                    搜索
                </Button>
            </div>

            {/* 页面级错误：走共享基座 ErrorState（原因 + 重试入口），不用手写红字 div。 */}
            {error && <ErrorState error={error} title="检索失败" onRetry={retry} style={{marginBottom: 16}} />}

            {loading ? (
                <LoadingState variant="list" rows={3} />
            ) : result ? (
                <>
                    <div style={{marginBottom: 8, color: '#475569', fontSize: 13}}>
                        命中 <b>{num(result.total_hits) ?? hits.length}</b> 条 · 耗时 <b>{num(result.elapsed_millis)}</b> ms
                        · 模式 <b>{result.mode}</b> · 召回分布 向量 <b>{num(stats.vector) ?? 0}</b>
                        / 关键词 <b>{num(stats.keyword) ?? 0}</b> / 图谱 <b>{num(stats.graph) ?? 0}</b>
                    </div>
                    {vectorBlind && (
                        <Alert
                            type="warning"
                            showIcon
                            style={{marginBottom: 16}}
                            message="向量召回恒为 0：不是没有向量，而是 L3 读写两侧集合名不一致"
                            description={
                                <span>
                                    collection <code>kb_default_chunks_chunks</code> 实测已存 11624 条 512 维向量，
                                    但读侧 <code>HybridSearcher.java:42</code> 用 <code>"kb_chunks"</code>、
                                    写侧 <code>DefaultKnowledgeBaseService.java:48</code> 用 <code>"chunks"</code>，
                                    拼出的物理名 <code>kb_default_chunks_kb_chunks</code> 不存在 ⇒
                                    <code>hasCollection()</code> 恒 false，向量分支静默返回空。
                                    当前有效召回只有关键词与图谱两路。
                                </span>
                            }
                        />
                    )}
                    {hits.length === 0 ? (
                        <EmptyState
                            title="没有召回到内容"
                            description={`接口通了，但「${result.query}」在该工作空间无召回（图谱实体 ${entities.length} 个）`}
                        />
                    ) : (
                        <List
                            dataSource={hits}
                            renderItem={hit => (
                                <List.Item key={hit.chunk_id} align="top">
                                    <List.Item.Meta
                                        title={
                                            <span style={{fontSize: 14}}>
                                                {hitTitle(hit)}{' '}
                                                <Space size={4} style={{display: 'inline-flex'}}>
                                                    <Tag>{hit.source}</Tag>
                                                    <Tag color="blue">score {num(hit.score)?.toFixed(4)}</Tag>
                                                    {hit.ordinal !== null && <Tag>分片 #{hit.ordinal}</Tag>}
                                                </Space>
                                            </span>
                                        }
                                        description={
                                            <>
                                                <div
                                                    style={{
                                                        whiteSpace: 'pre-wrap',
                                                        maxHeight: 180,
                                                        overflow: 'auto',
                                                        fontSize: 13,
                                                        color: '#334155',
                                                        background: '#f8fafc',
                                                        padding: 8,
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {hit.content || '（该命中无正文：include_content 未开或切片正文为空）'}
                                                </div>
                                                <div style={{fontSize: 12, color: '#94a3b8', marginTop: 4}}>
                                                    chunk {hit.chunk_id} · doc {hit.document_id}
                                                    {Array.isArray(hit.heading_path) && hit.heading_path.length > 0
                                                        ? ` · 路径 ${hit.heading_path.join(' / ')}` : ''}
                                                    {Array.isArray(hit.matched_entities) && hit.matched_entities.length > 0
                                                        ? ` · 实体 ${hit.matched_entities.join(', ')}` : ''}
                                                </div>
                                            </>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    )}
                </>
            ) : (
                <EmptyState title="输入关键词开始搜索" description="例如「InfluxDB 写入性能优化」，回车即搜。" />
            )}
        </Card>
    )
}
