/** 工作区选择 hook + 页面包装器（原 z-***REMOVED***-frontend App.tsx 的 currentWs 状态抽离）。 */
import {useEffect, useState} from 'react'
import {WorkspaceAPI} from './services/api'

const WS_KEY = 'z***REMOVED***_workspace'

export function use***REMOVED***Workspace() {
    const [workspaces, setWorkspaces] = useState([])
    const [workspace, setWorkspace] = useState(
        (typeof window !== 'undefined' && window.localStorage.getItem(WS_KEY)) || 'default')

    useEffect(() => {
        WorkspaceAPI.list().then((list) => {
            const names = (list || []).map((w) => w.name || w).filter(Boolean)
            setWorkspaces(names)
            if (names.length && !names.includes(workspace)) {
                setWorkspace(names[0])
            }
        }).catch(() => {})
    }, [])

    useEffect(() => {
        try { window.localStorage.setItem(WS_KEY, workspace) } catch { /* ignore */ }
    }, [workspace])

    return {workspaces, workspace, setWorkspace}
}

/** 页面包装器：***REMOVED*** 页面都吃 {workspace} prop。 */
export function with***REMOVED***Workspace(Page) {
    return function ***REMOVED***WorkspacePage() {
        const {workspace} = use***REMOVED***Workspace()
        return <Page workspace={workspace}/>
    }
}
