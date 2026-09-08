import React, { useState } from 'react'
import {
  Card, Button, Space, Typography, Spin, Tag, Row, Col, Statistic,
  Alert, List, Empty, Divider, message
} from 'antd'
import {
  BulbOutlined, ThunderboltOutlined, CopyOutlined, DownloadOutlined,
  ApartmentOutlined, RobotOutlined, FireOutlined
} from '@ant-design/icons'
import { ModelingAPI } from '../services/api'

interface Props { workspace: string }

interface CheatSheet {
  productName: string
  tagline: string
  markdown: string
  generatedAt: string
}

export default function ModelingPage({ workspace }: Props) {
  const [loading, setLoading] = useState(false)
  const [sheet, setSheet] = useState<CheatSheet | null>(null)
  const [model, setModel] = useState<any>(null)

  const generate = async () => {
    setLoading(true)
    try {
      const [pm, cs] = await Promise.all([
        ModelingAPI.decompose(workspace),
        ModelingAPI.cheatsheet(workspace),
      ])
      setModel(pm)
      setSheet(cs)
      message.success('已生成产品小抄')
    } catch (e: any) {
      message.error('生成失败：' + (e?.response?.data?.message || e?.message))
    } finally {
      setLoading(false)
    }
  }

  const copyMarkdown = () => {
    if (sheet?.markdown) {
      navigator.clipboard.writeText(sheet.markdown)
      message.success('已复制到剪贴板')
    }
  }

  const downloadMd = () => {
    if (!sheet) return
    const blob = new Blob([sheet.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sheet.productName || 'cheatsheet'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const meta = model?.metadata || {}

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                <RobotOutlined /> 产品建模
              </Typography.Title>
              <Typography.Text type="secondary">
                把工作台下的文档拆成可学习的逻辑因果链条，生成 Cheat Sheet（产品小抄）
              </Typography.Text>
            </div>
            <Space>
              <Button type="primary" icon={<ThunderboltOutlined />}
                      onClick={generate} loading={loading} size="large">
                {sheet ? '重新生成' : '生成产品小抄'}
              </Button>
              {sheet && (
                <>
                  <Button icon={<CopyOutlined />} onClick={copyMarkdown}>复制 Markdown</Button>
                  <Button icon={<DownloadOutlined />} onClick={downloadMd}>下载 .md</Button>
                </>
              )}
            </Space>
          </Space>
          {meta && Object.keys(meta).length > 0 && (
            <Row gutter={16}>
              <Col span={6}><Statistic title="源文档数" value={meta.documentCount || 0} prefix={<BulbOutlined />} /></Col>
              <Col span={6}><Statistic title="Chunks" value={meta.chunkCount || 0} /></Col>
              <Col span={6}><Statistic title="实体" value={meta.entityCount || 0} /></Col>
              <Col span={6}><Statistic title="因果链" value={meta.causalLinkCount || (model?.causalChain?.length || 0)} prefix={<FireOutlined />} /></Col>
            </Row>
          )}
        </Space>
      </Card>

      {loading && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="正在拆解知识库…" />
        </Card>
      )}

      {!loading && !sheet && (
        <Card>
          <Empty
            description={
              <span>
                当前工作台「{workspace}」还没有生成过小抄，
                点击右上角「生成产品小抄」即可。
              </span>
            }
          >
            <Button type="primary" onClick={generate} icon={<ThunderboltOutlined />}>立即生成</Button>
          </Empty>
        </Card>
      )}

      {sheet && !loading && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space direction="vertical" size="small">
              <Typography.Title level={2} style={{ margin: 0 }}>
                📦 {sheet.productName || '产品小抄'}
              </Typography.Title>
              {sheet.tagline && <Alert type="success" showIcon message={`一句话：${sheet.tagline}`} />}
            </Space>
          </Card>

          {model && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card title="🎯 目标用户" size="small">
                  {model.targetUsers?.length > 0 ? (
                    <List size="small" dataSource={model.targetUsers}
                          renderItem={(s: string) => <List.Item>• {s}</List.Item>} />
                  ) : <Typography.Text type="secondary">未识别</Typography.Text>}
                </Card>
              </Col>
              <Col span={8}>
                <Card title="⚡ 核心问题" size="small">
                  {model.coreProblems?.length > 0 ? (
                    <List size="small" dataSource={model.coreProblems}
                          renderItem={(s: string) => <List.Item>• {s}</List.Item>} />
                  ) : <Typography.Text type="secondary">未识别</Typography.Text>}
                </Card>
              </Col>
              <Col span={8}>
                <Card title="🛠️ 核心能力" size="small">
                  {model.capabilities?.length > 0 ? (
                    <List size="small" dataSource={model.capabilities.slice(0, 8)}
                          renderItem={(s: string) => <List.Item>• {s}</List.Item>} />
                  ) : <Typography.Text type="secondary">未识别</Typography.Text>}
                </Card>
              </Col>
            </Row>
          )}

          {model?.techStack && Object.keys(model.techStack).length > 0 && (
            <Card title="🧰 技术栈" size="small" style={{ marginBottom: 16 }}>
              <Space wrap>
                {Object.entries(model.techStack).map(([cat, items]: [string, any]) => (
                  <div key={cat} style={{ minWidth: 160 }}>
                    <Tag color="blue">{cat}</Tag>
                    <Typography.Text style={{ fontSize: 13 }}>
                      {Array.isArray(items) ? items.slice(0, 10).join('、') : ''}
                    </Typography.Text>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {model?.causalChain?.length > 0 && (
            <Card title={
              <Space>
                <ApartmentOutlined />
                因果链条（产品怎么工作的）
                <Tag color="red">{model.causalChain.length} 条</Tag>
              </Space>
            } size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={model.causalChain.slice(0, 15)}
                renderItem={(link: any, i: number) => (
                  <List.Item>
                    <Space>
                      <Tag color="orange">{i + 1}</Tag>
                      <Typography.Text strong style={{ maxWidth: 300 }} ellipsis={{ tooltip: link.cause }}>
                        {link.cause}
                      </Typography.Text>
                      <Tag color={relationColor(link.relation)}>
                        {relationZh(link.relation)}
                      </Tag>
                      <Typography.Text style={{ maxWidth: 300 }} ellipsis={{ tooltip: link.effect }}>
                        {link.effect}
                      </Typography.Text>
                      <Tag>置信度 {(link.confidence * 100).toFixed(0)}%</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card title="📄 完整小抄（Markdown 预览）" size="small">
            <pre style={{
              background: '#f6f8fa',
              padding: 16,
              borderRadius: 8,
              maxHeight: 600,
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {sheet.markdown}
            </pre>
          </Card>

          <Divider />
          <Typography.Text type="secondary">
            💡 提示：把这些小抄发给新人，他们能 5 分钟内 get 到产品的关键逻辑；后续可接入 LLM 增强抽取置信度。
          </Typography.Text>
        </>
      )}
    </div>
  )
}

function relationColor(r: string): string {
  return r === 'CAUSES' ? 'red' : r === 'ENABLES' ? 'green' : r === 'REQUIRES' ? 'orange' : 'blue'
}

function relationZh(r: string): string {
  const m: Record<string, string> = { CAUSES: '导致', ENABLES: '使得', REQUIRES: '需要', PRODUCES: '产出', TRIGGERS: '触发' }
  return m[r] || r
}