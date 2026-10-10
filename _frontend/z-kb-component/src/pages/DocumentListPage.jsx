import {useEffect, useState} from 'react'
import {Card, Table, Button, Select, Empty, Spin, Tag} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
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
        <Card
            title={`文档管理${total === null ? '' : `（${selectedWs} 共 ${total} 篇）`}`}
            extra={
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                    <Select
                        value={selectedWs}
                        onChange={ws => { setSelectedWs(ws); setPage(1) }}
                        style={{width: 200}}
                        placeholder="选择工作空间"
                        options={workspaces.map(w => ({label: w.name, value: w.name}))}
                    />
                    <Button icon={<ReloadOutlined/>} loading={loading} onClick={() => setReload(r => r + 1)}>
                        刷新
                    </Button>
                </div>
            }
        >
            {error ? (
                <div style={{color: '#ef4444', padding: 16}}>接口错误：{error}</div>
            ) : loading ? (
                <div style={{textAlign: 'center', padding: 40}}><Spin/></div>
            ) : documents.length === 0 ? (
                <Empty description={selectedWs ? `接口通了，${selectedWs} 下没有文档` : '请先选择工作空间'}/>
            ) : (
                <Table
                    dataSource={documents}
                    rowKey="id"
                    size="small"
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
                    pagination={{
                        current: page,
                        pageSize: PAGE_SIZE,
                        total: Number.isNaN(total) ? documents.length : total,
                        showSizeChanger: false,
                        onChange: setPage,
                    }}
                />
            )}
        </Card>
    )
}
