import {useEffect, useState} from 'react'
import {Button, Select, Space, Tag} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import {ErrorState, ListTable, LoadingState} from '@yuku123/z-frontend-common/ui'
import {kbApi} from '../services/api'

const PAGE_SIZE = 20

export default function DocumentListPage() {
    const [workspaces, setWorkspaces] = useState([])
    const [selectedWs, setSelectedWs] = useState(null)
    const [documents, setDocuments] = useState([])
    const [total, setTotal] = useState(null)
    const [page, setPage] = useState(1)
    const [reload, setReload] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        kbApi.listWorkspaces()
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setWorkspaces(list)
                if (list.length > 0) setSelectedWs(list[0].name)
            })
            .catch(e => setError(e.message))
    }, [])

    useEffect(() => {
        if (!selectedWs) return
        let cancelled = false
        setLoading(true)
        setError(null)
        const offset = (page - 1) * PAGE_SIZE
        Promise.all([
            kbApi.listDocuments(selectedWs, offset, PAGE_SIZE),
            kbApi.getDocumentCount(selectedWs),
        ]).then(([list, count]) => {
            if (cancelled) return
            setDocuments(Array.isArray(list) ? list : [])
            // /count 返回 {"count":"314"}，全局 SNAKE_CASE 把 long 序列化成字符串
            setTotal(Number(count?.count))
        }).catch(e => {
            if (cancelled) return
            setError(e.message)
        }).finally(() => {
            if (!cancelled) setLoading(false)
        })
        return () => { cancelled = true }
    }, [selectedWs, page, reload])

    return (
        <div>
            {/* 工作空间切换是**筛选条件**不是动作，留在表外；动作按钮（刷新）放 cardExtra。 */}
            <Space style={{marginBottom: 12}}>
                <Select
                    value={selectedWs}
                    onChange={ws => { setSelectedWs(ws); setPage(1) }}
                    style={{width: 200}}
                    placeholder="选择工作空间"
                    options={workspaces.map(w => ({label: w.name, value: w.name}))}
                />
            </Space>

            {error ? (
                // 页面级错误：走共享基座 ErrorState（原因 + 重试入口），不用手写红字 div。
                <ErrorState error={error} title="文档列表加载失败" onRetry={() => setReload(r => r + 1)} />
            ) : loading ? (
                <LoadingState variant="table" rows={4} />
            ) : (
                <ListTable
                    cardTitle={`文档管理${total === null ? '' : `（${selectedWs} 共 ${total} 篇）`}`}
                    rows={documents}
                    rowKey="id"
                    columns={[
                        {title: '标题', dataIndex: 'title', key: 'title'},
                        {title: '分类', dataIndex: 'category', key: 'category'},
                        {title: '状态', dataIndex: 'status', key: 'status'},
                        {title: '字数', dataIndex: 'word_count', key: 'word_count'},
                        {title: '切片数', dataIndex: 'chunk_count', key: 'chunk_count'},
                        {
                            title: '标签', dataIndex: 'tags', key: 'tags',
                            render: v => (Array.isArray(v) ? v.map(t => <Tag key={t}>{t}</Tag>) : v),
                        },
                        {title: '更新时间', dataIndex: 'updated_at', key: 'updated_at'},
                    ]}
                    searchKeys="title,category,status"
                    searchPlaceholder="按标题 / 分类 / 状态过滤"
                    emptyTitle="暂无文档"
                    emptyDescription={selectedWs ? `接口通了，${selectedWs} 下没有文档` : '请先选择工作空间'}
                    cardExtra={
                        <Button icon={<ReloadOutlined/>} loading={loading} onClick={() => setReload(r => r + 1)}>
                            刷新
                        </Button>
                    }
                    // 【服务端分页，不套客户端分页】这页的翻页是 offset/limit + total 的服务端分页
                    // （kbApi.listDocuments(ws, offset, limit) + kbApi.getDocumentCount(ws)），
                    // 换页必须重新请求后端 ⇒ 不能用基座那套客户端分页（DEFAULT_PAGINATION），
                    // 所以把原来的 pagination 对象原样传给 ListTable。
                    // searchKeys 的过滤只作用于**当前这一页**已取回的行。
                    pagination={{
                        current: page,
                        pageSize: PAGE_SIZE,
                        total: Number.isNaN(total) ? documents.length : total,
                        showSizeChanger: false,
                        onChange: setPage,
                    }}
                />
            )}
        </div>
    )
}
