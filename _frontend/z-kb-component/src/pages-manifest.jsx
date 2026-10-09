import {
    DashboardOutlined,
    FileTextOutlined,
    CloudUploadOutlined,
    ApartmentOutlined,
    SearchOutlined,
    PartitionOutlined,
    MessageOutlined,
} from '@ant-design/icons'
import './***REMOVED***/styles.css'
import {with***REMOVED***Workspace} from './***REMOVED***/workspaceHook'
import Dashboard from './***REMOVED***/pages/Dashboard'
import Documents from './***REMOVED***/pages/Documents'
import DataSources from './***REMOVED***/pages/DataSources'
import ModelingPage from './***REMOVED***/pages/ModelingPage'
import SearchPage from './***REMOVED***/pages/SearchPage'
import GraphPage from './***REMOVED***/pages/GraphPage'
import ChatPage from './***REMOVED***/pages/ChatPage'

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
    {path: 'dashboard', Component: with***REMOVED***Workspace(Dashboard)},
    {path: 'documents', Component: with***REMOVED***Workspace(Documents)},
    {path: 'ingest', Component: with***REMOVED***Workspace(DataSources)},
    {path: 'modeling', Component: with***REMOVED***Workspace(ModelingPage)},
    {path: 'search', Component: with***REMOVED***Workspace(SearchPage)},
    {path: 'graph', Component: with***REMOVED***Workspace(GraphPage)},
    {path: 'chat', Component: with***REMOVED***Workspace(ChatPage)},
]
export {routeTable}
export {with***REMOVED***Workspace, use***REMOVED***Workspace} from './***REMOVED***/workspaceHook'
export {DocAPI, SearchAPI, GraphAPI, WorkspaceAPI} from './***REMOVED***/services/api'
