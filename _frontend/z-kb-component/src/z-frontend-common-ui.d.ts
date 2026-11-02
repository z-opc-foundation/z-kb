/**
 * 基座 UI 桶（@yuku123/z-frontend-common/ui）的类型声明。
 *
 * 【为什么手写而不是等基座出 d.ts】
 * 基座是纯 JS 包（dist 里只有 js，没有 .d.ts），exports 的 './ui' 子路径也没配 types，
 * TS 直接 import 会报 TS7016 "Could not find a declaration file"。本仓 src/kb/pages 下
 * 是 .tsx（TypeScript 源码），所以必须像 z-surl 仓那样手写一份最小声明。
 *
 * 【维护约定】
 * 这里只声明本仓真正用到的组件；**props 以基座源码 src/components/ui/*.jsx 为准**，
 * 基座升版改了签名要回来同步（尤其是 ErrorState 的 variant / EmptyState 的 size /
 * ListTable 的 rows/columns/searchKeys 三个必填口径）。
 */
declare module '@yuku123/z-frontend-common/ui' {
  import type { CSSProperties, ReactElement, ReactNode } from 'react'

  /** 统一空态：图标 + 文案 + 行动按钮 */
  export function EmptyState(props: {
    icon?: ReactNode
    title?: string
    description?: ReactNode
    actionText?: string
    onAction?: () => void
    size?: 'sm' | 'md' | 'lg'
    style?: CSSProperties
  }): ReactElement

  /** 统一错误态：原因说明 + 重试入口（页面级错误用，业务 toast 不走这里） */
  export function ErrorState(props: {
    error?: unknown
    title?: string
    description?: ReactNode
    onRetry?: () => void
    retryText?: string
    variant?: 'inline' | 'full'
    style?: CSSProperties
  }): ReactElement

  /** 统一骨架屏：cards / table / list / detail 四种预设 */
  export function LoadingState(props: {
    variant?: 'cards' | 'table' | 'list' | 'detail'
    rows?: number
    active?: boolean
    style?: CSSProperties
  }): ReactElement

  /**
   * 列表页三件套成品件（lead 008 §2 强制规则 2/3/4）：
   *   规则 2 分页（pageSize + showSizeChanger + pageSizeOptions + showTotal）
   *   规则 3 查询（Card extra 里的过滤框，端侧过滤）
   *   规则 4 空态用 EmptyState，不是 antd 默认空图
   * 不传 searchKeys 就不渲染过滤框；cardProps 透传给外层 Card，tableProps 透传给内层 Table。
   */
  export function ListTable<T = any>(props: {
    rows?: T[]
    columns?: any[]
    rowKey?: string | ((record: T, index?: number) => string)
    loading?: boolean
    searchKeys?: string | string[]
    searchPlaceholder?: string
    searchWidth?: number
    cardTitle?: ReactNode
    cardExtra?: ReactNode
    emptyTitle?: string
    emptyDescription?: ReactNode
    emptyActionText?: string
    emptyOnAction?: () => void
    pagination?: any
    cardProps?: Record<string, any>
    tableProps?: Record<string, any>
    /** 其余 props 与 antd Table 一致，直接透传给内层 Table */
    [key: string]: any
  }): ReactElement

  /** §2 规则 2 的标准分页参数（不传 pagination 时 ListTable 用它） */
  export const DEFAULT_PAGINATION: {
    pageSize: number
    showSizeChanger: boolean
    pageSizeOptions: string[]
    showTotal: (total: number) => string
  }

  /**
   * 组件文档页（lead 008 §7）：左 240px TOC + 右正文两栏 + 滚动联动。
   * props 以基座源码 src/components/ui/ComponentDoc.jsx 为准。
   */
  export function ComponentDoc(props: {
    markdown?: string
    title?: string
    className?: string
    style?: CSSProperties
    [key: string]: any
  }): ReactElement
}
