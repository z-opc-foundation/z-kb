# z-kb-component

z-kb（知识库）跨仓唯一前端面：把「工作区 / 文档 / 数据接入 / 建模 / 检索 / 图谱 / 对话」
这一组知识库页面收敛成一个可复用的 React 组件包，由 `z-kb-suit` 独立壳、z-team 的
OpsWorkbench（`/kb/*` 通配挂载）或 z-opc 主壳挂载。

- **npm 包名**：`@yuku123/z-kb-component`
- **宿主接入**：`@yuku123/z-kb-component/pages`（manifest + 页面组件），主壳可只取 `ComponentDocPage`
- **后端**：z-kb-web 的 `/api/kb/**`（7 个 controller，真实路由 33 条）
- **技术栈**：React 19 + antd 6 + react-router-dom 7 + echarts 5 + vite
  （library mode，双入口 `.` / `./pages`）

---

## 一、能力概览

这个包里有**两套**页面树、**两套**请求层，路由前缀也不同，别混：

### 1.1 manifest 面（`/z-kb/*`，`src/pages-manifest.jsx`）

| 页面 | 路由（相对 `/z-kb/*`） | 源文件 | 能力 |
|------|--------------------------|--------|------|
| 首页 | `home` | `pages/HomePage.jsx` | 读 `userInfo` 显示登录人，按 `menuItems` 渲染功能入口卡片 |
| 总览 | `dashboard` | `kb/pages/Dashboard.tsx` | 工作区统计（文档数 / 分块数 / 实体数…） |
| 文档 | `documents` | `kb/pages/Documents.tsx` | 文档入库 / 重建索引 / 删除 |
| 数据接入 | `ingest` | `kb/pages/DataSources.tsx` | 数据源清单 + 批量接入 + webhook |
| 建模 | `modeling` | `kb/pages/ModelingPage.tsx` | 拆解工作台 + 小抄（cheatsheet） |
| 检索 | `search` | `kb/pages/SearchPage.tsx` | 混合检索（向量 / 关键词 / 图谱 / 融合） |
| 图谱 | `graph` | `kb/pages/GraphPage.tsx` | 实体邻域 / 子图（echarts） |
| 对话 | `chat` | `kb/pages/ChatPage.tsx` | 会话式问答 |
| 登录 | （不在菜单内） | `pages/LoginPage.jsx` | mock 登录，写 `token` / `userInfo` 后跳 `/z-kb/home` |
| 组件文档 | `docs` | `pages/ComponentDoc.jsx` | 本文件渲染页（左侧 240px TOC + 右侧正文） |

`manifest` 里这 7 个 kb 页面都套了一层 `withKbWorkspace(...)`（`kb/workspaceHook`），
由它统一注入当前工作区。

### 1.2 ZkbApp 面（`/kb/*`，`src/pages/ZkbApp.jsx`）

`ZkbApp` 是给 OpsWorkbench 通配挂载用的**子路由集合**，入口重定向到 `workspaces`：

| 子路由 | 源文件 | 能力 |
|--------|--------|------|
| `workspaces` | `pages/WorkspaceListPage.jsx` | 工作区清单 + 统计 |
| `documents` | `pages/DocumentListPage.jsx` | 文档清单（服务端分页）+ 删除 |
| `search` | `pages/SearchPage.jsx` | 检索（JS 版页面，与 `kb/pages/SearchPage.tsx` **是两个不同文件**） |

### 1.3 两套请求层

| 层 | 文件 | 出口 | 用在哪些页面 |
|----|------|------|--------------|
| TS 版（axios） | `src/kb/services/api.ts` | `DocAPI` / `SearchAPI` / `GraphAPI` / `WorkspaceAPI` / `ChatAPI` / `IngestAPI` / `ModelingAPI` | `kb/pages/*.tsx` 全部 7 个页面 |
| JS 版（fetch） | `src/services/api.js` | `kbApi` | `pages/WorkspaceListPage.jsx` / `pages/DocumentListPage.jsx` / `pages/SearchPage.jsx` |

主入口（`.` 桶）导的是 **JS 版**的 `kbApi`；`./pages` 桶导的是 **TS 版**的
`DocAPI` / `SearchAPI` / `GraphAPI` / `WorkspaceAPI`。

## 二、导出面

```js
// 主入口（. 桶）：JS 版请求层 + 域挂载点
import {kbApi, toNumber, DEFAULT_WORKSPACE, ZkbApp} from '@yuku123/z-kb-component'

// 宿主组装面（./pages 桶）：manifest + 页面组件（TS 版请求层也从这里出）
import {menuItems, routes, appMeta, HomePage, LoginPage,
        DocAPI, SearchAPI, GraphAPI, WorkspaceAPI,
        withKbWorkspace, useKbWorkspace, ComponentDocPage} from '@yuku123/z-kb-component/pages'

// 组件文档页（主壳接线用，名字全仓统一）
import {ComponentDocPage} from '@yuku123/z-kb-component'
```

## 三、API 端点

后端前缀 `/api/kb`。下表路径是 `src/kb/services/api.ts` 与 `src/services/api.js`
里出现的**实际路径**（两层的路径口径一致，只是实现不同）。

### 3.1 工作区

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kb/workspaces` | 工作区列表 |
| POST | `/api/kb/workspaces` | 新建工作区 |
| GET | `/api/kb/workspaces/{name}` | 单个工作区 |
| GET | `/api/kb/workspaces/{name}/statistics` | 工作区统计 |

### 3.2 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/kb/documents` | 建索引（body：`{document, overwrite, extractGraph, workspace}`） |
| POST | `/api/kb/documents/batch` | 批量建索引 |
| POST | `/api/kb/documents/markdown` | 导入 markdown |
| GET | `/api/kb/documents/{workspace}` | 文档列表（query：`offset` / `limit`，服务端分页） |
| GET | `/api/kb/documents/{workspace}/count` | 文档总数 |
| GET | `/api/kb/documents/{workspace}/by-tags` | 按标签查文档（query：`tags` / `offset` / `limit`） |
| GET | `/api/kb/documents/{workspace}/{id}` | 单篇文档 |
| DELETE | `/api/kb/documents/{workspace}/{id}` | 删除文档 |
| POST | `/api/kb/documents/{workspace}/{id}/reindex` | 重建索引 |

### 3.3 检索 / 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/kb/search` | 检索（body：`{query, workspace, mode, topK, ...}`，`mode` ∈ `FUSION`/`VECTOR`/`KEYWORD`/`GRAPH`/`HYBRID`） |
| POST | `/api/kb/chat` | 单轮问答 |
| POST | `/api/kb/chat/sessions` | 建会话 |
| GET | `/api/kb/chat/sessions` | 会话列表（query：`workspace` / `userId` / `limit`） |
| GET | `/api/kb/chat/sessions/{id}` | 单个会话 |
| DELETE | `/api/kb/chat/sessions/{id}` | 删会话 |
| POST | `/api/kb/chat/sessions/{id}/chat` | 会话内追问 |

### 3.4 图谱

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kb/graph/{workspace}/entities` | 实体列表（query：`limit`） |
| GET | `/api/kb/graph/{workspace}/entities/{name}` | 单个实体 |
| GET | `/api/kb/graph/{workspace}/entities/{name}/neighbors` | 邻域（query：`depth`） |
| POST | `/api/kb/graph/{workspace}/subgraph?depth=` | 子图（body 是实体名数组） |

### 3.5 数据接入 / 建模

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kb/ingest/sources` | 数据源清单 + 支持的类型 |
| GET | `/api/kb/ingest/stats` | 接入统计 |
| POST | `/api/kb/ingest/run?sourceId=` | 跑一次接入 |
| POST | `/api/kb/ingest/submit` | 批量提交接入 |
| POST | `/api/kb/ingest/webhook` | 通用 webhook 入口 |
| POST | `/api/kb/ingest/webhook/flush` | flush webhook 队列 |
| GET | `/api/kb/modeling/decompose?workspace=` | 拆解工作台 |
| GET | `/api/kb/modeling/cheatsheet?workspace=` | 取小抄 |
| POST | `/api/kb/modeling/cheatsheet` | 写回小抄（body 是整份 ProductModel） |

## 四、页面说明

### 4.1 首页

登录后的着陆页。读 `localStorage.userInfo` 显示欢迎语与角色标签，再把 `menuItems`（去掉首页自身）
渲染成入口卡片 —— 菜单加一项，首页卡片自动多一张，不用改页面代码。

### 4.2 总览 / 文档 / 数据接入 / 建模 / 检索 / 图谱 / 对话

这 7 个页面在 `src/kb/pages/` 下（`.tsx`），都套 `withKbWorkspace` 注入当前工作区：

- **总览**：工作区统计（文档数 / 分块数 / 实体数 / 命中率等）。
- **文档**：文档入库（`overwrite` / `extractGraph` 开关）、重建索引、删除。
- **数据接入**：数据源清单（`sourceId` / 类型 / 启用与否）+ 批量接入 + webhook 入口。
- **建模**：拆解工作台（慢接口，可能 1–3 分钟）+ 小抄（cheatsheet）读写。
- **检索**：按 `mode` 切 向量 / 关键词 / 图谱 / 融合检索。
- **图谱**：实体邻域与子图，用 echarts 画（源码引的是 tree-shaken 子路径）。
- **对话**：会话式问答。

### 4.3 工作区 / 文档清单 / 检索（ZkbApp 面）

`src/pages/` 下的三个 JS 页面：**工作区**清单 + 统计、**文档**清单（服务端分页，
总数另走 `/count`）、**检索**。⚠ `pages/SearchPage.jsx` 与 `kb/pages/SearchPage.tsx`
**是两个不同的文件**（前者用 `kbApi`，后者用 `SearchAPI`），改一个不会影响另一个。

### 4.4 登录

当前是 **mock 模式**：比对一对写死在 `src/pages/LoginPage.jsx` 里的管理员凭据
（明文口令不在本文复述，见源码），成功后写 `localStorage.token` 与 `localStorage.userInfo`，
再 `window.location.href = '/z-kb/home'`。CTC/SSO 尚未接入。

### 4.5 组件文档

本文件。内容以 `?raw` 在编译期内联，零额外请求；左侧 240px TOC 随滚动联动。

## 五、配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| 后端前缀 | `/api/kb` | 两层请求层都用这个前缀 |
| 默认工作区 | `default` | `DEFAULT_WORKSPACE` |
| 普通请求超时 | `30000` ms | TS 版 axios 实例 |
| 慢请求超时 | `300000` ms | TS 版 `slowApi`（建模 / 大批量 ingest 用） |
| 文档分页 | `offset=0` / `limit=20` | JS 版 `listDocuments` 的默认页长 |
| 实体列表条数 | `100` | `listEntities` 的默认 `limit` |

## 六、已知限制

- ⚠ **请求体字段两种拼写都发**：宿主（z-opc）全局 Jackson 是 `SNAKE_CASE`，
  z-kb 单跑则是 camelCase。⇒ JS 版 `wire()` 给每个 camelCase 键**补一个 snake_case 别名**
  （不删原键），Boot 默认忽略未知属性 ⇒ 两边都收得下。
  实测宿主里 `top_k` 生效、`topK` 被忽略。
  `frontmatter` / `metadata` / `properties` / `config` 四个键是**用户自己的 map**，
  键名任意，不改写。
- ⚠ **响应字段在宿主里是下划线 + 字符串**：宿主把 long 序列化成字符串
  （`document_count` / `chunk_count` / `created_at` / `count`）。
  JS 版请求层**不改响应形状**（改了会连带把 `WorkspaceListPage` / `DocumentListPage` 弄坏），
  需要数值时用 `toNumber()`。
- **两套请求层并存**：TS 版走 axios（有超时、有 `slowApi`），JS 版走原生 `fetch`
  （**没有超时**，慢请求靠浏览器/网关口径）。两层的响应解包口径也不同。
- **同名不同文件**：`pages/SearchPage.jsx` ≠ `kb/pages/SearchPage.tsx`；
  `DocumentListPage` / `WorkspaceListPage` 也只在 JS 层存在。
- `kbApi` 的 `createDocument` / `batchCreateDocuments` / `importMarkdown` / `reindexDocument` /
  `listDocumentsByTags` / `getDocument` / `deleteDocument` / `getWorkspace` / `createWorkspace` /
  `getWorkspaceStats` / `chat` / `createSession` / `getSession` / `listSessions` /
  `deleteSession` / `chatInSession` / `listEntities` / `getEntity` / `getNeighbors` /
  `getSubgraph` / `listSources` / `getIngestStats` / `runIngest` / `submitIngest` /
  `webhook` / `flushWebhook` / `decompose` / `getCheatsheet` / `createCheatsheet`
  在 **JS 层定义了但当前没有页面调用**（这些页面对应的是 TS 版那套）。
- **graph / ingest / modeling 三个 controller 没有裸根路由**：
  第一条就是 `/{workspace}/...` 或 `/sources`、`/stats`、`/decompose`。
- echarts 走 tree-shaken 子路径（`echarts/core`、`echarts/charts`、`echarts-for-react/lib/core`），
  `vite.config.js` 用函数式 `external` 把 `echarts/` 与 `echarts-for-react/` 前缀整体外置 ——
  否则本包会多带 800KB+ 的 echarts，且绕开宿主的按需注册能力。
- z-kb 已被 z-opc 主壳的 `domainRoutes.ts` 与 z-team 的 OpsWorkbench 引用
  ⇒ `/z-kb/docs` 在平台主壳里**可达**。

## 七、变更记录

| 版本 | 变更 |
|---|---|
| 0.1.2 | 新增组件文档页 `ComponentDocPage`（lead 008 §7）：`src/DOC.md` + 基座 `ComponentDoc` 薄包装 |
| 0.1.2 | 首版：工作区 / 文档 / 接入 / 建模 / 检索 / 图谱 / 对话页面集 + manifest + ZkbApp 挂载点 |
