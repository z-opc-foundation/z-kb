import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Tag } from 'antd'
import { FileTextOutlined, BlockOutlined, ShareAltOutlined, ApartmentOutlined } from '@ant-design/icons'
import { EmptyState, LoadingState } from '@yuku123/z-frontend-common/ui'
import { WorkspaceAPI } from '../services/api'
import type { KBStatistics } from '../types'

interface Props { workspace: string }

const StatCard = ({ icon, label, value, color }: any) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ fontSize: 32, color, marginRight: 16 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{value ?? '-'}</div>
        <div style={{ color: '#8c8c8c' }}>{label}</div>
      </div>
    </div>
  </Card>
)

export default function Dashboard({ workspace }: Props) {
  const [stats, setStats] = useState<KBStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    WorkspaceAPI.statistics(workspace)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [workspace])

  // 页面级加载：骨架屏代替 antd Spin（基座 LoadingState，避免内容跳动 / CLS）
  if (loading) return <LoadingState variant="cards" rows={4} />

  if (!stats) {
    return <EmptyState title="工作台不存在或暂无数据" description={`工作台「${workspace}」还没有统计信息，先在「数据接入」里拉取一批文档。`} />
  }

  const tagEntries = stats.tagCloud ? Object.entries(stats.tagCloud).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 30) : []

  return (
    <div>
      <Typography.Title level={3}>📊 工作台「{workspace}」</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><StatCard icon={<FileTextOutlined />} label="文档数" value={stats.documentCount} color="#1677ff" /></Col>
        <Col span={6}><StatCard icon={<BlockOutlined />} label="块数" value={stats.chunkCount} color="#52c41a" /></Col>
        <Col span={6}><StatCard icon={<ShareAltOutlined />} label="实体数" value={stats.entityCount} color="#fa8c16" /></Col>
        <Col span={6}><StatCard icon={<ApartmentOutlined />} label="关系数" value={stats.relationCount} color="#eb2f96" /></Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="🏷️ 标签云" extra={stats.embeddingProvider && <Tag color="cyan">Embedding: {stats.embeddingProvider}</Tag>}>
            {tagEntries.length === 0 ? (
              <EmptyState title="暂无标签" description="导入文档后这里会按出现次数显示标签云。" size="sm" />
            ) : (
              <div style={{ lineHeight: 2 }}>
                {tagEntries.map(([tag, count]) => (
                  <Tag key={tag as string} color="blue" style={{ marginBottom: 4 }}>
                    {tag as string} × {count as number}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="📈 实体类型分布">
            {stats.entityTypeDistribution && Object.keys(stats.entityTypeDistribution).length > 0 ? (
              <div style={{ lineHeight: 2 }}>
                {Object.entries(stats.entityTypeDistribution)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([type, count]) => (
                    <Tag key={type} color="purple" style={{ marginBottom: 4 }}>
                      {type} × {count as number}
                    </Tag>
                  ))}
              </div>
            ) : <EmptyState title="暂无图谱数据" description="导入文档并完成图谱抽取后，这里会显示实体类型分布。" size="sm" />}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="ℹ️ 系统信息">
        <Row gutter={16}>
          <Col span={8}><strong>总存储:</strong> {(stats.totalSizeBytes / 1024).toFixed(2)} KB</Col>
          <Col span={8}><strong>Embedding:</strong> {stats.embeddingProvider || '-'}</Col>
          <Col span={8}><strong>Chunks:</strong> {stats.chunkCount}</Col>
        </Row>
      </Card>
    </div>
  )
}
