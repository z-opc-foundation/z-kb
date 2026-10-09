import React, { useState, useEffect } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Space, Typography,
  Popconfirm, Tag, message, Spin, Upload, Tabs
} from 'antd'
import { PlusOutlined, DeleteOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons'
import { DocAPI } from '../services/api'
import type { Document } from '../types'

interface Props { workspace: string }

export default function Documents({ workspace }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [importing, setImporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await DocAPI.list(workspace, 0, 100)
      setDocs(list)
    } catch (e) {
      message.error('加载失败：' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [workspace])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setImporting(true)
    try {
      const result = await DocAPI.importMarkdown({
        workspace,
        title: values.title,
        content: values.content,
        tags: values.tags ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        author: values.author,
      })
      if (result.success) {
        message.success(`导入成功：${result.title}（${result.chunkCount} 个块，${result.entityCount} 个实体）`)
        setModalOpen(false)
        form.resetFields()
        load()
      } else {
        message.error('导入失败：' + result.errorMessage)
      }
    } catch (e) {
      message.error('导入失败：' + (e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const handleBatchImport = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const result = await DocAPI.importMarkdown({
        workspace,
        title: file.name.replace(/\.md$/, ''),
        content: text,
        tags: ['batch-import'],
        author: 'batch-import',
      })
      if (result.success) {
        message.success(`批量导入成功：${result.chunkCount} 个块，${result.entityCount} 个实体`)
        load()
      } else {
        message.error('导入失败：' + result.errorMessage)
      }
    } catch (e) {
      message.error('导入失败：' + (e as Error).message)
    } finally {
      setImporting(false)
    }
    return false  // prevent default upload
  }

  const handleDelete = async (id: string) => {
    try {
      await DocAPI.delete(workspace, id)
      message.success('删除成功')
      load()
    } catch (e) {
      message.error('删除失败：' + (e as Error).message)
    }
  }

  const handleReindex = async (id: string) => {
    try {
      const result = await DocAPI.reindex(workspace, id)
      if (result.success) {
        message.success(`重建索引成功：${result.chunkCount} 个块`)
        load()
      }
    } catch (e) {
      message.error('重建失败：' + (e as Error).message)
    }
  }

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (text: string, record: Document) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{text || '(无标题)'}</Typography.Text>
          {record.path && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.path}</Typography.Text>}
        </Space>
      )
    },
    { title: '标签', dataIndex: 'tags', key: 'tags',
      render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) || '-' },
    { title: '字数', dataIndex: 'wordCount', key: 'wordCount' },
    { title: '块数', dataIndex: 'chunkCount', key: 'chunkCount' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color="green">{s || 'INDEXED'}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt',
      render: (t: string) => t ? new Date(t).toLocaleString() : '-' },
    { title: '操作', key: 'actions',
      render: (_: any, record: Document) => (
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => handleReindex(record.id)}>重建</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>📄 文档管理 · {workspace}</Typography.Title>
      </Space>

      <Tabs
        items={[
          {
            key: 'list',
            label: '文档列表',
            children: (
              <Card>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                    新增文档
                  </Button>
                  <Upload beforeUpload={handleBatchImport} showUploadList={false} accept=".md">
                    <Button icon={<InboxOutlined />} loading={importing}>批量导入 .md 文件</Button>
                  </Upload>
                  <Button onClick={load}>刷新</Button>
                </Space>
                <Table
                  columns={columns}
                  dataSource={docs}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  size="middle"
                />
              </Card>
            )
          }
        ]}
      />

      <Modal
        title="新增文档"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={importing}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="文档标题" />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="例如：数据库, 时序, InfluxDB" />
          </Form.Item>
          <Form.Item name="content" label="Markdown 内容" rules={[{ required: true }]}>
            <Input.TextArea rows={12} placeholder="# 标题\n\n正文内容..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
