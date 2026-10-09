import {
    DashboardOutlined,
    FileTextOutlined,
    CloudUploadOutlined,
    ApartmentOutlined,
    SearchOutlined,
    PartitionOutlined,
    MessageOutlined,
} from '@ant-design/icons'
import './kb/styles.css'
import {withKbWorkspace} from './kb/workspaceHook'
import Dashboard from './kb/pages/Dashboard'
import Documents from './kb/pages/Documents'
import DataSources from './kb/pages/DataSources'
import ModelingPage from './kb/pages/ModelingPage'
import SearchPage from './kb/pages/SearchPage'
import GraphPage from './kb/pages/GraphPage'
import ChatPage from './kb/pages/ChatPage'

export const menuItems = [
    {key: '/dashboard', icon: <DashboardOutlined/>, label: '总览'},
    {key: '/documents', icon: <FileTextOutlined/>, label: '文档'},
    {key: '/ingest', icon: <CloudUploadOutlined/>, label: '数据接入'},
    {key: '/modeling', icon: <ApartmentOutlined/>, label: '建模'},
    {key: '/search', icon: <SearchOutlined/>, label: '检索'},
    {key: '/graph', icon: <PartitionOutlined/>, label: '图谱'},
    {key: '/chat', icon: <MessageOutlined/>, label: '对话'},
]

const routeTable = [
    {path: 'dashboard', Component: withKbWorkspace(Dashboard)},
    {path: 'documents', Component: withKbWorkspace(Documents)},
    {path: 'ingest', Component: withKbWorkspace(DataSources)},
    {path: 'modeling', Component: withKbWorkspace(ModelingPage)},
    {path: 'search', Component: withKbWorkspace(SearchPage)},
    {path: 'graph', Component: withKbWorkspace(GraphPage)},
    {path: 'chat', Component: withKbWorkspace(ChatPage)},
]
export {routeTable}
export {withKbWorkspace, useKbWorkspace} from './kb/workspaceHook'
export {DocAPI, SearchAPI, GraphAPI, WorkspaceAPI} from './kb/services/api'
