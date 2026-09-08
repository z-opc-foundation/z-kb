import React, { useState, useEffect } from 'react'
import { Layout, Menu, Typography, Space, Select, Tag } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, SearchOutlined,
  ShareAltOutlined, MessageOutlined, ApiOutlined,
  CloudUploadOutlined, RobotOutlined
} from '@ant-design/icons'
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import SearchPage from './pages/SearchPage'
import GraphPage from './pages/GraphPage'
import ChatPage from './pages/ChatPage'
import DataSources from './pages/DataSources'
import ModelingPage from './pages/ModelingPage'
import { WorkspaceAPI } from './services/api'
import type { Workspace } from './types'

const { Header, Sider, Content } = Layout

export default function App() {
  const location = useLocation()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWs, setCurrentWs] = useState<string>('default')

  useEffect(() => {
    WorkspaceAPI.list().then(list => {
      setWorkspaces(list)
      if (list.length > 0) setCurrentWs(list[0].name)
    }).catch(console.error)
  }, [])

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">仪表板</Link> },
    { key: '/documents', icon: <FileTextOutlined />, label: <Link to="/documents">文档管理</Link> },
    { key: '/ingest', icon: <CloudUploadOutlined />, label: <Link to="/ingest">数据接入</Link> },
    { key: '/modeling', icon: <RobotOutlined />, label: <Link to="/modeling">产品建模</Link> },
    { key: '/search', icon: <SearchOutlined />, label: <Link to="/search">检索</Link> },
    { key: '/graph', icon: <ShareAltOutlined />, label: <Link to="/graph">知识图谱</Link> },
    { key: '/chat', icon: <MessageOutlined />, label: <Link to="/chat">RAG 问答</Link> },
  ]

  const selectedKey = '/' + location.pathname.split('/')[1] || '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="layout-header">
        <Space size="middle">
          <Typography.Title level={4} style={{ color: 'white', margin: 0 }}>📚 z-kb</Typography.Title>
          <Tag color="blue">v1.0.0</Tag>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            自研产品级知识库系统
          </Typography.Text>
        </Space>
        <Space size="middle">
          <Select
            value={currentWs}
            onChange={setCurrentWs}
            style={{ width: 160 }}
            options={workspaces.map(w => ({ value: w.name, label: `📁 ${w.name}` }))}
          />
          <a href="/doc.html" target="_blank" rel="noopener">
            <ApiOutlined /> API 文档
          </a>
        </Space>
      </Header>
      <Layout>
        <Sider width={220} className="layout-sider">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content className="layout-content">
          <Routes>
            <Route path="/" element={<Dashboard workspace={currentWs} />} />
            <Route path="/documents" element={<Documents workspace={currentWs} />} />
            <Route path="/ingest" element={<DataSources workspace={currentWs} />} />
            <Route path="/modeling" element={<ModelingPage workspace={currentWs} />} />
            <Route path="/search" element={<SearchPage workspace={currentWs} />} />
            <Route path="/graph" element={<GraphPage workspace={currentWs} />} />
            <Route path="/chat" element={<ChatPage workspace={currentWs} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
