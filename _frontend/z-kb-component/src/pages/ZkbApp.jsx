import {Navigate, Route, Routes} from 'react-router-dom'
import WorkspaceListPage from './WorkspaceListPage'
import DocumentListPage from './DocumentListPage'
import SearchPage from './SearchPage'

export default function ZkbApp() {
    return (
        <Routes>
            <Route index element={<Navigate to="workspaces" replace/>}/>
            <Route path="workspaces" element={<WorkspaceListPage/>}/>
            <Route path="documents" element={<DocumentListPage/>}/>
            <Route path="search" element={<SearchPage/>}/>
        </Routes>
    )
}
