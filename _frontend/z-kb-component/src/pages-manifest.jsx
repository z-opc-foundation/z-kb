import { ApartmentOutlined, CloudUploadOutlined, DashboardOutlined, FileTextOutlined, HomeOutlined, MessageOutlined, PartitionOutlined, ReadOutlined, SearchOutlined } from '@ant-design/icons'
import './***REMOVED***/styles.css'
import {with***REMOVED***Workspace} from './***REMOVED***/workspaceHook'
import Dashboard from './***REMOVED***/pages/Dashboard'
import Documents from './***REMOVED***/pages/Documents'
import DataSources from './***REMOVED***/pages/DataSources'
import ModelingPage from './***REMOVED***/pages/ModelingPage'
import SearchPage from './***REMOVED***/pages/SearchPage'
import GraphPage from './***REMOVED***/pages/GraphPage'
import ChatPage from './***REMOVED***/pages/ChatPage'


export {with***REMOVED***Workspace, use***REMOVED***Workspace} from './***REMOVED***/workspaceHook'
export {DocAPI, SearchAPI, GraphAPI, WorkspaceAPI} from './***REMOVED***/services/api'
import HomePage from './pages/HomePage'
import ***REMOVED***App from './pages/***REMOVED***App.jsx'
import ComponentDocPage from './pages/ComponentDoc.jsx'

/** 菜单 + 路由清单（lead 008 §10/§14/§16 批量落地）。App 壳在 suit 侧组装。 */
export const appMeta = { title: 'z-***REMOVED*** 知识库', short: 'z-***REMOVED***' }

export const menuItems = [
    { key: '/z-***REMOVED***/home', label: '首页', icon: <HomeOutlined /> },
    { key: '/z-***REMOVED***/dashboard', label: '总览', icon: <DashboardOutlined /> },
    { key: '/z-***REMOVED***/documents', label: '文档', icon: <FileTextOutlined /> },
    { key: '/z-***REMOVED***/ingest', label: '数据接入', icon: <CloudUploadOutlined /> },
    { key: '/z-***REMOVED***/modeling', label: '建模', icon: <ApartmentOutlined /> },
    { key: '/z-***REMOVED***/search', label: '检索', icon: <SearchOutlined /> },
    { key: '/z-***REMOVED***/graph', label: '图谱', icon: <PartitionOutlined /> },
    { key: '/z-***REMOVED***/chat', label: '对话', icon: <MessageOutlined /> },
    { key: '/z-***REMOVED***/docs', label: '组件文档', icon: <ReadOutlined /> },
]

export const routes = [
    { path: '/z-***REMOVED***/home', Component: HomePage },
    { path: '/z-***REMOVED***/dashboard', Component: with***REMOVED***Workspace(Dashboard) },
    { path: '/z-***REMOVED***/documents', Component: with***REMOVED***Workspace(Documents) },
    { path: '/z-***REMOVED***/ingest', Component: with***REMOVED***Workspace(DataSources) },
    { path: '/z-***REMOVED***/modeling', Component: with***REMOVED***Workspace(ModelingPage) },
    { path: '/z-***REMOVED***/search', Component: with***REMOVED***Workspace(SearchPage) },
    { path: '/z-***REMOVED***/graph', Component: with***REMOVED***Workspace(GraphPage) },
    { path: '/z-***REMOVED***/chat', Component: with***REMOVED***Workspace(ChatPage) },
    { path: '/z-***REMOVED***/docs', Component: ComponentDocPage },
    { path: '/z-***REMOVED***/:rest*', Component: ***REMOVED***App },
]

export { default as HomePage } from './pages/HomePage'
export { default as LoginPage } from './pages/LoginPage'
// 主壳接线用：文档页统一以 ComponentDocPage 这个名字从主入口导出。
export { default as ComponentDocPage } from './pages/ComponentDoc.jsx'
