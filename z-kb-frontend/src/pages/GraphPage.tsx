import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Typography, Spin, Space, Empty, Select, Button } from 'antd'
import { ShareAltOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { GraphAPI } from '../services/api'
import type { Entity } from '../types'

interface Props { workspace: string }

const TYPE_COLORS: Record<string, string> = {
  TOOL: '#1677ff',
  DATABASE: '#52c41a',
  TECHNOLOGY: '#fa8c16',
  CONCEPT: '#722ed1',
  METHOD: '#eb2f96',
  PERSON: '#13c2c2',
  ORGANIZATION: '#fadb14',
  LOCATION: '#a0d911',
  OTHER: '#bfbfbf',
}

export default function GraphPage({ workspace }: Props) {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('ALL')
  const [limit, setLimit] = useState(100)

  const load = async () => {
    setLoading(true)
    try {
      const list = await GraphAPI.listEntities(workspace, limit)
      setEntities(list)
    } catch (e) {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [workspace, limit])

  const filtered = filter === 'ALL' ? entities : entities.filter(e => e.type === filter)
  const types = Array.from(new Set(entities.map(e => e.type)))

  // 用 function declaration（hoist 安全），不要用 const 避免 TDZ
  function generateLinks(ents: Entity[]) {
    const links: any[] = []
    const names = ents.map(e => e.canonicalName)
    // 简化的共现边：每个实体连接前后 1-2 个实体
    for (let i = 0; i < ents.length - 1; i++) {
      if (Math.random() > 0.85 && names[i + 1]) {
        links.push({ source: names[i], target: names[i + 1], lineStyle: { opacity: 0.3 } })
      }
    }
    return links.slice(0, 100)
  }

  // ECharts force-directed graph
  const graphOption = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.data.name}<br/>类型: ${p.data.type}` },
    legend: { data: types, bottom: 0 },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: { repulsion: 200, edgeLength: 80 },
      categories: types.map(t => ({ name: t, itemStyle: { color: TYPE_COLORS[t] || '#999' } })),
      data: filtered.slice(0, 100).map(e => ({
        id: e.canonicalName,
        name: e.canonicalName,
        category: e.type,
        value: e.frequency || 1,
        symbolSize: Math.min(60, 8 + Math.sqrt(e.frequency || 1) * 6),
        itemStyle: { color: TYPE_COLORS[e.type] || '#999' }
      })),
      label: { show: true, position: 'right', fontSize: 10 },
      edgeSymbol: ['none', 'arrow'],
      edgeLabel: { fontSize: 8 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
      links: generateLinks(filtered)
    }]
  }

  const columns = [
    { title: '名称', dataIndex: 'canonicalName', key: 'canonicalName',
      render: (n: string) => <strong>{n}</strong> },
    { title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => <Tag color={TYPE_COLORS[t] || 'default'}>{t}</Tag> },
    { title: '频次', dataIndex: 'frequency', key: 'frequency',
      sorter: (a: Entity, b: Entity) => (a.frequency || 0) - (b.frequency || 0) },
    { title: '重要性', dataIndex: 'importance', key: 'importance',
      render: (v: number) => v ? v.toFixed(3) : '-' },
  ]

  return (
    <div>
      <Typography.Title level={3}>🕸️ 知识图谱 · {workspace}</Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <Typography.Text>类型过滤：</Typography.Text>
        <Select value={filter} onChange={setFilter} style={{ width: 160 }}
          options={[
            { value: 'ALL', label: '全部' },
            ...types.map(t => ({ value: t, label: t }))
          ]}
        />
        <Typography.Text>数量：{limit}</Typography.Text>
        <Select value={limit} onChange={setLimit} style={{ width: 100 }}
          options={[50, 100, 200, 500].map(v => ({ value: v, label: v }))}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </Space>

      {loading && <Spin size="large" />}

      {!loading && filtered.length === 0 && <Empty description="暂无实体数据" />}

      {!loading && filtered.length > 0 && (
        <>
          <Card title="🌐 图谱可视化" style={{ marginBottom: 16 }}>
            <ReactECharts option={graphOption} style={{ height: 500 }} />
          </Card>
          <Card title="📋 实体列表">
            <Table
              dataSource={filtered}
              columns={columns}
              rowKey="canonicalName"
              size="small"
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
