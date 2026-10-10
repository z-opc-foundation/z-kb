import {useEffect, useState} from 'react'
import {Card, Table, Button, Empty, Spin} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import {kbApi} from '../services/api'

export default function WorkspaceListPage() {
    const [workspaces, setWorkspaces] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await kbApi.listWorkspaces()
            setWorkspaces(Array.isArray(data) ? data : [])
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    return (
        <Card
            title="知识库工作空间"
            extra={<Button icon={<ReloadOutlined/>} loading={loading} onClick={load}>刷新</Button>}
        >
            {error ? (
                <div style={{color: '#ef4444', padding: 16}}>
                    接口错误：{error}
                    <div style={{fontSize: 12, color: '#94a3b8', marginTop: 8}}>
                        确认 z-kb 后端已启动且 /api/kb/workspaces 可达
                    </div>
                </div>
            ) : loading ? (
                <div style={{textAlign: 'center', padding: 40}}><Spin/></div>
            ) : workspaces.length === 0 ? (
                <Empty description="接口通了，但一个工作空间也没有"/>
            ) : (
                <Table
                    dataSource={workspaces}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                        {title: '名称', dataIndex: 'name', key: 'name'},
                        {title: '描述', dataIndex: 'description', key: 'description'},
                        // 字段名按实测响应写：z-team-core 的全局 SNAKE_CASE 会把这些 VO 转成下划线键
                        {title: '文档数', dataIndex: 'document_count', key: 'document_count'},
                        {title: '切片数', dataIndex: 'chunk_count', key: 'chunk_count'},
                        {title: '实体数', dataIndex: 'entity_count', key: 'entity_count'},
                        {title: '关系数', dataIndex: 'relation_count', key: 'relation_count'},
                        {
                            title: '状态', dataIndex: 'active', key: 'active',
                            render: v => (v === false ? '未启用' : '启用'),
                        },
                        {title: '创建时间', dataIndex: 'created_at', key: 'created_at'},
                    ]}
                />
            )}
        </Card>
    )
}
