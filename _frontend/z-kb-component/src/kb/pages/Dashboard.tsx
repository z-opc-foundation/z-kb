import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Spin, Tag, Empty } from 'antd'
import { FileTextOutlined, BlockOutlined, ShareAltOutlined, ApartmentOutlined } from '@ant-design/icons'
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

  if (loading) return <Spin size="large" />

  if (!stats) {
    return <Empty description={`工作台 ${workspace} 不存在或暂无数据`} />
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
            {tagEntries.length === 0 ? <Empty /> : (
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
            ) : <Empty description="暂无图谱数据" />}
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
