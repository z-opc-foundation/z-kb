import React, { useState, useEffect } from 'react'
import {
  Card, Button, Table, Tag, Space, Typography, Form, Input, Select,
  Modal, message, Tabs, Row, Col, Statistic, Alert
} from 'antd'
import {
  CloudUploadOutlined, PlayCircleOutlined, ReloadOutlined,
  ThunderboltOutlined, ApiOutlined, LinkOutlined, FolderOutlined,
  GlobalOutlined, FileTextOutlined, GithubOutlined, DingtalkOutlined,
  WechatWorkOutlined, MessageOutlined, StopOutlined
} from '@ant-design/icons'
import { IngestAPI } from '../services/api'

interface Props { workspace: string }

interface SourceDef { sourceId: string; type: string; label: string; enabled: boolean }
interface SourceType { name: string; label: string }
interface IngestSummary {
  count: number
  success: number
  failed: number
  skipped: number
  totalChunks: number
  totalEntities: number
  totalRelations: number
  items: Array<{ requestId: string; documentId: string | null; status: string; elapsedMillis: number; chunkCount: number; entityCount: number; relationCount: number; error?: string }>
}

const typeIcon: Record<string, React.ReactNode> = {
  YUQUE: <FileTextOutlined />,
  NOTION: <FileTextOutlined />,
  CONFLUENCE: <GlobalOutlined />,
  FEISHU: <WechatWorkOutlined />,
  DINGTALK: <DingtalkOutlined />,
  GIT: <GithubOutlined />,
  LOCAL_DIR: <FolderOutlined />,
  URL: <LinkOutlined />,
  WEBHOOK: <ApiOutlined />,
  UPLOAD: <CloudUploadOutlined />,
  MARKDOWN: <MessageOutlined />,
}

const typeColor: Record<string, string> = {
  YUQUE: 'blue', NOTION: 'purple', CONFLUENCE: 'cyan', FEISHU: 'geekblue',
  DINGTALK: 'orange', GIT: 'magenta', LOCAL_DIR: 'green', URL: 'gold',
  WEBHOOK: 'volcano', UPLOAD: 'lime', MARKDOWN: 'default',
}

export default function DataSources({ workspace }: Props) {
  const [sources, setSources] = useState<SourceDef[]>([])
  const [supportedTypes, setSupportedTypes] = useState<SourceType[]>([])
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<IngestSummary | null>(null)
  const [stats, setStats] = useState<{ success: number; failed: number; skipped: number; totalRequests: number; chunks: number; entities: number; relations: number } | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [currentSource, setCurrentSource] = useState<SourceDef | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    try {
      const res = await IngestAPI.listSources()
      setSources(res.sources)
      setSupportedTypes(res.supportedTypes)
      const s = await IngestAPI.stats()
      setStats(s as any)
    } catch (e) {
      console.error(e)
    }
  }

  const openConfig = (s: SourceDef) => {
    setCurrentSource(s)
    form.resetFields()
    // 预设一些常用字段
    form.setFieldsValue({ workspace })
    setConfigOpen(true)
  }

  const runIngest = async () => {
    if (!currentSource) return
    let config: Record<string, any> = {}
    try {
      config = await form.validateFields()
    } catch (e) {
      return
    }
    setRunning(true)
    setConfigOpen(false)
    try {
      const res = await IngestAPI.run(currentSource.sourceId, config)
      setLastResult(res)
      message.success(`已处理 ${res.count} 个文档（成功 ${res.success}）`)
      refresh()
    } catch (e: any) {
      message.error('拉取失败：' + (e?.response?.data?.message || e?.message))
    } finally {
      setRunning(false)
    }
  }

  const columns = [
    { title: '图标', dataIndex: 'type', key: 'icon', width: 50,
      render: (t: string) => typeIcon[t] || <FileTextOutlined /> },
    { title: '渠道', dataIndex: 'label', key: 'label',
      render: (l: string, r: SourceDef) => (
        <Space>
          <Tag color={typeColor[r.type]}>{r.type}</Tag>
          <span>{l}</span>
        </Space>
      ) },
    { title: 'Source ID', dataIndex: 'sourceId', key: 'sourceId',
      render: (s: string) => <code style={{ fontSize: 12 }}>{s}</code> },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (e: boolean) => e ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag> },
    { title: '操作', key: 'op', width: 120,
      render: (_: any, r: SourceDef) => (
        <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                onClick={() => openConfig(r)} loading={running}>
          接入
        </Button>
      ) },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>📡 多渠道数据接入</Typography.Title>
              <Typography.Text type="secondary">
                把企业知识库（语雀 / Notion / Confluence / 飞书 / 钉钉 / Git / 本地目录 / URL / Webhook）一键接入到 z-kb
              </Typography.Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
              <Button type="primary" icon={<ThunderboltOutlined />}
                      onClick={async () => { await IngestAPI.flushWebhook(); refresh() }}>
                拉取 Webhook 缓冲
              </Button>
            </Space>
          </Space>
        </Card>

        {stats && (
          <Row gutter={16}>
            <Col span={4}><Card><Statistic title="累计请求" value={stats.totalRequests} /></Card></Col>
            <Col span={4}><Card><Statistic title="成功" value={stats.success} valueStyle={{ color: '#3f8600' }} /></Card></Col>
            <Col span={4}><Card><Statistic title="失败" value={stats.failed} valueStyle={{ color: '#cf1322' }} /></Card></Col>
            <Col span={4}><Card><Statistic title="跳过（重复）" value={stats.skipped} /></Card></Col>
            <Col span={4}><Card><Statistic title="Chunks" value={stats.chunks} /></Card></Col>
            <Col span={4}><Card><Statistic title="实体/关系" value={`${stats.entities}/${stats.relations}`} /></Card></Col>
          </Row>
        )}

        <Card title="内置数据源（点击「接入」配置参数后触发拉取）">
          <Table dataSource={sources} columns={columns} rowKey="sourceId" pagination={false} size="middle" />
        </Card>

        {lastResult && (
          <Card title={`最近一次接入结果（${lastResult.count} 个文档）`}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="成功" value={lastResult.success} valueStyle={{ color: '#3f8600' }} prefix={<ThunderboltOutlined />} /></Col>
              <Col span={6}><Statistic title="失败" value={lastResult.failed} valueStyle={{ color: '#cf1322' }} prefix={<StopOutlined />} /></Col>
              <Col span={6}><Statistic title="跳过（重复）" value={lastResult.skipped} /></Col>
              <Col span={6}><Statistic title="Chunks" value={lastResult.totalChunks} /></Col>
            </Row>
            <Table
              dataSource={lastResult.items}
              rowKey="requestId"
              size="small"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', render: (s: string) => <code style={{ fontSize: 11 }}>{s.substring(0, 12)}…</code> },
                { title: '状态', dataIndex: 'status', key: 'status',
                  render: (s: string) => {
                    const color = s === 'SUCCESS' ? 'success' : s === 'FAILED' ? 'error' : 'default'
                    return <Tag color={color}>{s}</Tag>
                  } },
                { title: 'Chunks', dataIndex: 'chunkCount', key: 'chunkCount' },
                { title: '实体', dataIndex: 'entityCount', key: 'entityCount' },
                { title: '关系', dataIndex: 'relationCount', key: 'relationCount' },
                { title: '耗时 (ms)', dataIndex: 'elapsedMillis', key: 'elapsedMillis' },
                { title: '错误', dataIndex: 'error', key: 'error', render: (e: string) => e ? <Typography.Text type="danger" style={{ fontSize: 12 }}>{e}</Typography.Text> : '-' },
              ]}
            />
          </Card>
        )}

        <Card title="支持的渠道一览">
          <Space wrap>
            {supportedTypes.map(t => (
              <Tag key={t.name} color={typeColor[t.name] || 'default'} icon={typeIcon[t.name]}>
                {t.label} ({t.name})
              </Tag>
            ))}
          </Space>
        </Card>
      </Space>

      <Modal
        title={`接入配置 — ${currentSource?.label} (${currentSource?.type})`}
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={runIngest}
        okText="开始接入"
        confirmLoading={running}
        width={600}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={renderHint(currentSource?.type)}
        />
        <Form form={form} layout="vertical">
          <Form.Item name="workspace" label="目标工作台" rules={[{ required: true }]}>
            <Input placeholder="例如：yuque-loc" />
          </Form.Item>
          {renderFields(currentSource?.type, form)}
        </Form>
      </Modal>
    </div>
  )
}

function renderHint(type?: string) {
  switch (type) {
    case 'YUQUE': return '语雀 token：在语雀「个人设置 → Token」创建；namespace 形如 myorg/mybook'
    case 'NOTION': return 'Notion token：在 notion.so/my-integrations 创建；databaseId 或 pageId 必填一个'
    case 'CONFLUENCE': return 'Confluence 需要账号邮箱 + API Token；spaceKey 在空间设置里找'
    case 'FEISHU': return '飞书开放平台创建应用获取 appId/appSecret；spaceId 在知识库 URL 里'
    case 'DINGTALK': return '钉钉开放平台创建应用；workspaceId 是文档空间 ID'
    case 'GIT': return 'GitHub / GitLab / Gitee 的 API；私有仓库需 token'
    case 'LOCAL_DIR': return '扫描本地目录下的 .md 文件并入库（支持递归）'
    case 'URL': return '抓取指定 URL 页面，自动 HTML → Markdown'
    case 'WEBHOOK': return '通过 POST /api/kb/ingest/webhook 推送，会先入缓冲区再批量入库'
    default: return '配置后点击「开始接入」即可拉取'
  }
}

function renderFields(type: string | undefined, form: any) {
  const f = (name: string, label: string, placeholder: string, required = true) => (
    <Form.Item key={name} name={name} label={label} rules={required ? [{ required: true }] : []}>
      <Input placeholder={placeholder} />
    </Form.Item>
  )
  switch (type) {
    case 'YUQUE':
      return [
        f('token', '语雀 Token', 'personal access token'),
        f('namespace', 'Namespace', 'myorg/mybook'),
        f('limit', 'Limit（可选）', '100', false),
      ]
    case 'NOTION':
      return [
        f('token', 'Notion Token', 'integration secret'),
        f('databaseId', 'Database ID（与 pageId 二选一）', '', false),
        f('pageId', 'Page ID（与 databaseId 二选一）', '', false),
      ]
    case 'CONFLUENCE':
      return [
        f('baseUrl', 'Base URL', 'https://your-domain.atlassian.net/wiki'),
        f('username', '账号邮箱', 'you@example.com'),
        f('apiToken', 'API Token', 'ATATT3xFfGF0...'),
        f('spaceKey', '空间 KEY', 'DEV'),
      ]
    case 'FEISHU':
      return [
        f('appId', 'App ID', 'cli_xxx'),
        f('appSecret', 'App Secret', 'xxx'),
        f('spaceId', 'Space ID', '7xxxxxxxxxxxxxxx'),
      ]
    case 'DINGTALK':
      return [
        f('appKey', 'AppKey', 'dingxxxxxx'),
        f('appSecret', 'AppSecret', 'xxx'),
        f('workspaceId', 'Workspace ID（可选）', '', false),
      ]
    case 'GIT':
      return [
        f('platform', '平台', 'github / gitlab / gitee', false),
        f('owner', 'Owner', 'torvalds'),
        f('repo', 'Repo', 'linux'),
        f('ref', '分支/tag', 'main', false),
        f('token', 'Token（私有仓库需要）', '', false),
        f('path', '子目录前缀（可选）', '', false),
      ]
    case 'LOCAL_DIR':
      return [
        f('path', '本地目录绝对路径', '/Users/me/Documents/notes'),
        <Form.Item key="recursive" name="recursive" label="递归子目录" valuePropName="checked" initialValue={true}>
          <Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} />
        </Form.Item>,
      ]
    case 'URL':
      return [
        f('url', 'URL', 'https://example.com/article'),
        f('title', '标题（可选）', '', false),
      ]
    default:
      return [<Alert key="noop" type="warning" showIcon message="该渠道直接由其它接口触发（如 webhook 走 /api/kb/ingest/webhook）" />]
  }
}