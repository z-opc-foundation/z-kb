import {useEffect, useState} from 'react'
import {Button} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import {ErrorState, ListTable, LoadingState} from '@yuku123/z-frontend-common/ui'
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
        <div>
            {error ? (
                // 页面级错误：走共享基座 ErrorState（就近显示原因 + 重试入口），
                // 不用手写红字 div —— 全仓错误态口径统一。
                <ErrorState
                    error={error}
                    title="工作空间列表加载失败"
                    description="确认 z-kb 后端已启动且 /api/kb/workspaces 可达。"
                    onRetry={load}
                />
            ) : loading ? (
                <LoadingState variant="table" rows={4} />
            ) : (
                <ListTable
                    cardTitle="知识库工作空间"
                    rows={workspaces}
                    rowKey="id"
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
                    searchKeys="name,description"
                    searchPlaceholder="按工作空间名 / 描述过滤"
                    emptyTitle="还没有工作空间"
                    emptyDescription="接口通了，但一个工作空间也没有。先在「数据接入」里创建或拉取一个工作空间。"
                    // 【为什么不用 pagination={false}】工作空间是用户自己在「数据接入」里建的，
                    // 条数随使用增长，不是「已知 ≤10 行且不变」的小数据集 ⇒ 不能按 §2 规则 2 豁免分页，
                    // 改用基座的默认分页（DEFAULT_PAGINATION）。
                    cardExtra={
                        <Button icon={<ReloadOutlined/>} loading={loading} onClick={load}>刷新</Button>
                    }
                />
            )}
        </div>
    )
}
