import { ApartmentOutlined, CloudUploadOutlined, DashboardOutlined, FileTextOutlined, HomeOutlined, MessageOutlined, PartitionOutlined, SearchOutlined } from '@ant-design/icons'
import './kb/styles.css'
import {withKbWorkspace} from './kb/workspaceHook'
import Dashboard from './kb/pages/Dashboard'
import Documents from './kb/pages/Documents'
import DataSources from './kb/pages/DataSources'
import ModelingPage from './kb/pages/ModelingPage'
import SearchPage from './kb/pages/SearchPage'
import GraphPage from './kb/pages/GraphPage'
import ChatPage from './kb/pages/ChatPage'


export {withKbWorkspace, useKbWorkspace} from './kb/workspaceHook'
export {DocAPI, SearchAPI, GraphAPI, WorkspaceAPI} from './kb/services/api'
import HomePage from './pages/HomePage'
import ZkbApp from './pages/ZkbApp.jsx'

/** 菜单 + 路由清单（lead 008 §10/§14/§16 批量落地）。App 壳在 suit 侧组装。 */
export const appMeta = { title: 'z-kb 知识库', short: 'z-kb' }

export const menuItems = [
    { key: '/z-kb/home', label: '首页', icon: <HomeOutlined /> },
    { key: '/z-kb/dashboard', label: '总览', icon: <DashboardOutlined /> },
    { key: '/z-kb/documents', label: '文档', icon: <FileTextOutlined /> },
    { key: '/z-kb/ingest', label: '数据接入', icon: <CloudUploadOutlined /> },
    { key: '/z-kb/modeling', label: '建模', icon: <ApartmentOutlined /> },
    { key: '/z-kb/search', label: '检索', icon: <SearchOutlined /> },
    { key: '/z-kb/graph', label: '图谱', icon: <PartitionOutlined /> },
    { key: '/z-kb/chat', label: '对话', icon: <MessageOutlined /> },
]

export const routes = [
    { path: '/z-kb/home', Component: HomePage },
    { path: '/z-kb/dashboard', Component: withKbWorkspace(Dashboard) },
    { path: '/z-kb/documents', Component: withKbWorkspace(Documents) },
    { path: '/z-kb/ingest', Component: withKbWorkspace(DataSources) },
    { path: '/z-kb/modeling', Component: withKbWorkspace(ModelingPage) },
    { path: '/z-kb/search', Component: withKbWorkspace(SearchPage) },
    { path: '/z-kb/graph', Component: withKbWorkspace(GraphPage) },
    { path: '/z-kb/chat', Component: withKbWorkspace(ChatPage) },
    { path: '/z-kb/:rest*', Component: ZkbApp },
]

export { default as HomePage } from './pages/HomePage'
export { default as LoginPage } from './pages/LoginPage'
