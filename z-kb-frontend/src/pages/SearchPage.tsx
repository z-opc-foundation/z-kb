import React, { useState } from 'react'
import { Card, Input, Select, Button, Space, Typography, Tag, Empty, Spin, Slider, Row, Col } from 'antd'
import { SearchOutlined, BulbOutlined } from '@ant-design/icons'
import { SearchAPI } from '../services/api'
import type { SearchResult, SearchHit } from '../types'

interface Props { workspace: string }

const MODE_LABELS: Record<string, string> = {
  VECTOR: '🧠 向量',
  KEYWORD: '🔤 关键词',
  GRAPH: '🕸️ 图谱',
  HYBRID: '🔀 混合',
  FUSION: '✨ 全融合',
}

export default function SearchPage({ workspace }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'VECTOR' | 'KEYWORD' | 'GRAPH' | 'HYBRID' | 'FUSION'>('FUSION')
  const [topK, setTopK] = useState(10)
  const [vecW, setVecW] = useState(0.5)
  const [kwW, setKwW] = useState(0.3)
  const [grW, setGrW] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const r = await SearchAPI.search({
        query,
        workspace,
        topK,
        mode,
        vectorWeight: vecW,
        keywordWeight: kwW,
        graphWeight: grW,
        includeContent: true,
      })
      setResult(r)
    } catch (e) {
      // 静默失败：搜索结果无内容时显示空状态
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Typography.Title level={3}>🔍 智能检索 · {workspace}</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            size="large"
            placeholder="输入问题或关键词，例如：InfluxDB 写入性能优化"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Button type="primary" size="large" onClick={handleSearch} loading={loading}>搜索</Button>
        </Space.Compact>
        <Row gutter={16}>
          <Col span={6}>
            <div>召回模式</div>
            <Select
              value={mode}
              onChange={setMode}
              style={{ width: '100%', marginTop: 4 }}
              options={Object.entries(MODE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Col>
          <Col span={6}>
            <div>返回数量：{topK}</div>
            <Slider min={1} max={50} value={topK} onChange={setTopK} />
          </Col>
          {(mode === 'HYBRID' || mode === 'FUSION') && (
            <>
              <Col span={4}>
                <div>向量权重：{vecW.toFixed(1)}</div>
                <Slider min={0} max={1} step={0.1} value={vecW} onChange={setVecW} />
              </Col>
              <Col span={4}>
                <div>关键词权重：{kwW.toFixed(1)}</div>
                <Slider min={0} max={1} step={0.1} value={kwW} onChange={setKwW} />
              </Col>
              <Col span={4}>
                <div>图谱权重：{grW.toFixed(1)}</div>
                <Slider min={0} max={1} step={0.1} value={grW} onChange={setGrW} />
              </Col>
            </>
          )}
        </Row>
      </Card>

      {loading && <Spin size="large" />}

      {!loading && result && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Tag color="blue">查询：{result.query}</Tag>
              <Tag color="green">模式：{MODE_LABELS[result.mode] || result.mode}</Tag>
              <Tag color="orange">命中：{result.totalHits}</Tag>
              <Tag>耗时：{result.elapsedMillis}ms</Tag>
              {result.stats && Object.entries(result.stats).map(([k, v]) =>
                v > 0 ? <Tag key={k} color="purple">{k}: {v}</Tag> : null
              )}
            </Space>
          </Card>

          {result.hits.length === 0 && <Empty description="未找到相关内容" />}

          {result.hits.map((hit: SearchHit, idx: number) => (
            <div key={idx} className="search-hit">
              <div className="search-hit-meta">
                <Space>
                  <Tag color="cyan">#{idx + 1}</Tag>
                  <Tag color="blue">score: {hit.score.toFixed(3)}</Tag>
                  <Tag>{hit.source}</Tag>
                  {hit.contextTitle && <Tag color="geekblue">{hit.contextTitle}</Tag>}
                </Space>
              </div>
              {hit.documentTitle && <Typography.Title level={5}>{hit.documentTitle}</Typography.Title>}
              <div className="search-hit-content">
                {hit.content ? (
                  <>
                    {hit.content.length > 500 ? hit.content.substring(0, 500) + '...' : hit.content}
                  </>
                ) : <em>（无原文）</em>}
              </div>
              {hit.matchedKeywords && hit.matchedKeywords.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {hit.matchedKeywords.slice(0, 5).map(k => <Tag key={k} color="green">{k}</Tag>)}
                </div>
              )}
              {hit.matchedEntities && hit.matchedEntities.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {hit.matchedEntities.map(e => <Tag key={e} color="purple">🏷️ {e}</Tag>)}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {!loading && !result && (
        <Card>
          <Empty description={<span><BulbOutlined /> 输入关键词开始检索</span>} />
        </Card>
      )}
    </div>
  )
}
