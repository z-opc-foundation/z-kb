import React, { useState, useEffect, useRef } from 'react'
import {
  Card, Input, Button, Space, Typography, List, Tag, Spin,
  Empty, message, Avatar, Modal, Form
} from 'antd'
import {
  SendOutlined, MessageOutlined, UserOutlined, RobotOutlined,
  PlusOutlined, DeleteOutlined, BulbOutlined
} from '@ant-design/icons'
import { ChatAPI } from '../services/api'
import type { ChatSession, ChatMessage as Msg, ChatResponse } from '../types'

interface Props { workspace: string }

export default function ChatPage({ workspace }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ChatAPI.listSessions(workspace).then(setSessions).catch(() => {})
  }, [workspace])

  useEffect(() => {
    if (!currentSession) { setMessages([]); return }
    ChatAPI.getSession(currentSession.id).then(s => {
      setMessages(s.messages || [])
    }).catch(() => setMessages([]))
  }, [currentSession && currentSession.id])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const createSession = async () => {
    const values = await form.validateFields()
    try {
      const s = await ChatAPI.createSession(workspace, values.title)
      setSessions([s].concat(sessions))
      setCurrentSession(s)
      setModalOpen(false)
      form.resetFields()
      message.success('会话已创建')
    } catch (e) {
      message.error('创建失败：' + (e as Error).message)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text) return
    const userMsg: Msg = {
      role: 'USER',
      content: text,
      sessionId: currentSession ? currentSession.id : undefined,
      createdAt: new Date().toISOString(),
    }
    setMessages(messages.concat([userMsg]))
    setInput('')
    setLoading(true)

    try {
      let response: ChatResponse
      if (currentSession) {
        response = await ChatAPI.chatInSession(currentSession.id, text)
      } else {
        response = await ChatAPI.chat({ question: text, workspace, topK: 5 })
      }
      const aiMsg: Msg = {
        role: 'ASSISTANT',
        content: response.answer,
        references: response.references,
        mentionedEntities: response.relatedEntities,
        sessionId: currentSession ? currentSession.id : undefined,
        createdAt: new Date().toISOString(),
      }
      setMessages(messages.concat([userMsg, aiMsg]))
    } catch (e) {
      message.error('回答失败：' + (e as Error).message)
      setMessages(messages.concat([userMsg, {
        role: 'ASSISTANT',
        content: '抱歉，回答生成失败。',
        createdAt: new Date().toISOString(),
      }]))
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (id: string) => {
    try {
      await ChatAPI.deleteSession(id)
      setSessions(sessions.filter(s => s.id !== id))
      if (currentSession && currentSession.id === id) setCurrentSession(null)
    } catch (e) {
      message.error('删除失败')
    }
  }

  const sessionTitle = currentSession ? currentSession.title : '临时对话'
  const userBubbleColor = '#1677ff'
  const aiBubbleColor = '#f6f8fa'

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>
      <Card
        title="💬 会话"
        extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新会话</Button>}
        style={{ width: 280, overflow: 'auto' }}
        bodyStyle={{ padding: 8 }}
      >
        <List
          size="small"
          dataSource={sessions}
          locale={{ emptyText: <Empty description="暂无会话" /> }}
          renderItem={(s) => {
            const active = currentSession && currentSession.id === s.id
            const itemStyle: React.CSSProperties = {
              cursor: 'pointer',
              padding: '8px 12px',
              background: active ? '#e6f4ff' : 'transparent',
              borderRadius: 6,
            }
            return (
              <List.Item
                style={itemStyle}
                onClick={() => setCurrentSession(s)}
                actions={[
                  <Button
                    key="del"
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                  />
                ]}
              >
                <Space>
                  <MessageOutlined />
                  <span>{s.title}</span>
                </Space>
              </List.Item>
            )
          }}
        />
      </Card>

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {messages.length === 0 && (
            <Empty
              description={
                <span>
                  <BulbOutlined /> {currentSession ? '开始与「' + sessionTitle + '」对话' : '开始提问（无会话时使用临时模式）'}
                </span>
              }
            />
          )}
          {messages.map((m, idx) => {
            const isUser = m.role === 'USER'
            const flexDir = isUser ? 'row-reverse' : 'row'
            const bubbleStyle: React.CSSProperties = {
              maxWidth: '70%',
              background: isUser ? userBubbleColor : aiBubbleColor,
              color: isUser ? 'white' : 'inherit',
              padding: 12,
              borderRadius: 8,
            }
            const containerStyle: React.CSSProperties = {
              display: 'flex',
              gap: 12,
              marginBottom: 16,
              flexDirection: flexDir,
            }
            return (
              <div key={idx} style={containerStyle}>
                <Avatar icon={isUser ? <UserOutlined /> : <RobotOutlined />} />
                <div style={bubbleStyle}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {m.references && m.references.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>📎 参考来源：</Typography.Text>
                      {m.references.slice(0, 5).map((r, i) => (
                        <div key={i} style={{ marginTop: 4, fontSize: 12 }}>
                          <Tag color="blue">[{i + 1}]</Tag>
                          <Typography.Text style={{ fontSize: 12 }}>{(r.documentTitle || r.chunkId)}</Typography.Text>
                          <Tag color="cyan">{r.source}</Tag>
                          <span style={{ color: '#8c8c8c' }}>score: {r.score.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {loading && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin tip="思考中..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} loading={loading}>
            发送
          </Button>
        </div>
      </Card>

      <Modal
        title="新建会话"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createSession}
      >
        <Form form={form}>
          <Form.Item name="title" label="会话标题" rules={[{ required: true }]}>
            <Input placeholder="例如：InfluxDB 学习笔记" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
