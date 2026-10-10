import {Navigate, Route, Routes} from 'react-router-dom'
import {AppLayout} from '../../../../_shared/z-frontend-common-local/dist/z-frontend-common.es.js'
import {menuItems, routeTable} from '@yuku123/z-***REMOVED***-component/pages'
import '@yuku123/z-***REMOVED***-component/style.css'

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/" element={
                <AppLayout menuItems={menuItems} appTitle="z-***REMOVED*** 知识库" appShort="***REMOVED***" appIcon={{icon: <img src="/icon.png" alt="***REMOVED***" style={{width: "100%", height: "100%", objectFit: "cover", borderRadius: 8}}/>, color: '#d97706', label: '***REMOVED***'}}/>
            }>
                {routeTable.map((r) => (
                    <Route key={r.path} path={r.path} element={<r.Component/>}/>
                ))}
            </Route>
        </Routes>
    )
}
