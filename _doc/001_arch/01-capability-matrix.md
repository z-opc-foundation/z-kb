# 能力对标矩阵：future-brain（参考） → z-kb（我方）

> 日期：2026-10-31｜参考物：`~/Downloads/future_brain_20261031_141924`（后端 `future-brain` + 前端 `fe_future-brain`）
> 口径：**只认真实落地代码**（参考仓 README 自述「模块存在不等于能力可用」），逐项核到 Controller / Service / 实体类。

## 1. 规模对照（一手实测）

| 项 | 参考 future-kb | 我方 z-kb | 差 |
|---|---|---|---|
| REST Controller | 20 个 | 7 个 | 13 |
| REST 端点 | 98 | ≈40 | ≈58 |
| 主源码类 | 513 | 136（含全仓） | — |
| 领域子域 | 13（compilation / concept / evaluation / extraction / graph / ingest / knowledgebase / material / overview / retrieval / taskconfig / taskmonitor / wiki） | 7（documents / search / graph / ingest / modeling / chat / workspaces） | 6+ |
| 持久化 | MySQL（MyBatis DO/Mapper） | JSON 文件 / 内存（z-kb-storage）+ z-vector + z-graph | — |
| 权限 | 租户隔离 + 库级 ACL（`KnowledgeBaseAclDO` / `KnowledgeBaseMember*` 已实现） | **无**（无 tenant / acl / member 概念） | 全缺 |

参考仓「只有骨架、不算能力」的部分（不纳入覆盖目标）：`future-ontology`、`future-ai` 底座、`future-schedule`、`future-sso` 自研实现、`future-task`。其中本体域与我方 `z-ontology` 重叠，按仓归属由 z-ontology 承担，不在 z-kb 内重复造。

## 2. 能力域对标

优先级：P0=地基（没有它后面都做不了）｜P1=主链路可见能力｜P2=治理/增强

| 域 | 参考端点 | 我方现状 | 缺口要点 | 优先级 | 波次 |
|---|---|---|---|---|---|
| knowledgebase | 13 + activity 1 + member 5 | 无（只有 workspace 概念） | 知识库作为**一等资源**：CRUD / 归档 / 恢复 / 删除 / 列表分页筛选 / 概览统计 / 活跃度 / 成员与 ACL / 配置版本（草稿-校验-发布-重建） | P0 | W1 |
| material | 17 + category 5 + repo 3 | documents 9（索引/批导/markdown/取/删/列表/按标签/重建/计数） | 资料类型与状态机、**多版本**、解析稿编辑保存、回收站（还原/彻底清除）、目录树 CRUD+移动、批量改类、代码仓浏览（tree/file/overview）、原件下载 | P0 | W2 |
| compilation | 14 | 无（索引流水线是同步一次性） | 编译任务可见化：job / batch / stage / artifact / chunk、重试、取消、批次取消、阶段看板、hasRunningBatch | P1 | W3 |
| retrieval | 1 | search 1 | 命中**可解释**（explanation / matchedTerms / score / 截断提示 / 候选与扫描统计 / 索引状态与时间）、模式化（dense/bm25/hybrid）、topK+minScore 调参、wiki 命中联动 | P1 | W4 |
| wiki | 8 | 无（仅 markdown 双链解析） | 资料→知识页生成、列表/详情/按资料反查、**谱系 lineage**、来源资料回链 | P1 | W5 |
| extraction / concept | 1 + 2 | extractor（实体/关系） | 知识点抽取（summary/问题/术语…）、概念库（概念列表/详情/提及）、概念↔实体↔图谱联动 | P1 | W6 |
| graph | 2 | graph 4（entities/neighbors/subgraph） | 按资料反查图谱、全库图谱（含证据块号）、图谱↔wiki 联动 | P2 | W7 |
| evaluation | 11 | core/eval 8 类（库内可跑，无 REST） | 数据集草稿/发布、跑批、用例结果、坏例与信任证据 | P2 | W8 |
| taskconfig / taskmonitor | 4 | ingest/stats 1 | 任务配置（全局/库级）发布、任务监控分页与汇总、14 天趋势 | P2 | W8 |
| auditlog | 2 | 无 | 操作日志（统计/明细/操作者筛选） | P2 | W8 |
| knowledgebasesource | 6 | ingest 9 种 DataSource（但无「源配置」实体与同步测试） | 数据源配置持久化、连接测试、触发同步、语雀两级目录拉取 | P2 | W8 |
| overview | 1 | workspaces/statistics 1 | 库级总览：文件数/已编译/未编译/运行中/失败/wiki 数、最近资料、刷新时间 | P1 | W1 |
| ingest（接入） | 4（core service） | 9 种源 + pipeline + webhook + stats | 基本对齐；需补「源配置实体」与同步编排 | P2 | W8 |

**W0（地基）**：数据模型迁移——引入 `KnowledgeBase`（库）、`Material`+`MaterialVersion`（资料/版本）、`Category`（目录）三张主实体，文档 `Document` 降级为资料的一个版本视图。这是 W1–W8 的前提，且必须一次性把 API 路径、存储与前端契约对齐，不能边做边改。

## 3. 我方已有、参考仓没有或形态不同的（保留，不推翻）

| 能力 | 我方 | 说明 |
|---|---|---|
| 五模式检索 | `SearchMode` = VECTOR / KEYWORD / GRAPH / HYBRID / FUSION | 参考仓只有 dense 为主，其余标注「后续」；我方这层更强，要保留并在新契约里显式暴露 |
| 离线 embedding | `TfIdfEmbeddingProvider`（无外部依赖可跑） | 参考仓依赖远端 embedding 服务；我方保留离线兜底 |
| 知识建模 | `z-kb-modeling`（产品拆解 / 因果链 / 小抄） | 参考仓对应本体建模，但依赖外部图库；我方这块保留自研 |
| 9 种接入源 | Confluence / 钉钉 / 飞书 / Git / 本地目录 / Notion / URL / Webhook / 语雀 | 参考仓 source provider 为 YUQUE / GIT / OSS / SMB / JDBC；我方这层更宽，需保留并把 provider 收敛成可配置实体 |
| RAG 问答 | `DefaultChatService` + 会话 | 参考仓走 AI 底座（其底座是骨架）；我方自研可独立运行 |

## 4. 前端：可照搬 vs 必须重写

参考前端 `fe_future-brain`：React 19 + TS strict + Vite 6 + HashRouter + antd 5（几乎不用，只用 Spin/Tree/ConfigProvider/App，视觉是自研 CSS 类）+ `@antv/g6` 5.1 + d3-force + ag-grid + pdfjs/docx-preview/pptx-preview/xlsx + axios + less；约 5.8 万行源码 + 161 个测试文件。

### 4.1 可直接照搬（低耦合）

| 资产 | 位置 | 说明 |
|---|---|---|
| 视觉体系 | `src/styles/global.css`（2340 行、40+ CSS 变量、602 工具类） | 纯 CSS，抄走即得「看起来像」 |
| 图标集 | `src/components/icon/`（30+ 内联 SVG） | 无第三方依赖 |
| 弹窗/确认框 | `components/app-modal/`、`components/confirm/` | 自研 Promise 化确认 |
| 文档预览器 | `components/material-preview-{pdf,docx,pptx,sheet,text}.tsx` + `material-preview-kind.ts` | 与后端无关，只吃 Blob；改下载 URL 即用 |
| Markdown 渲染 | `material-draft-markdown.tsx`、`pages/ai/markdown.tsx`（MarkdownLite） | 自研、安全、不用 innerHTML |
| 活跃度图 | `kb-activity-chart.tsx` | 手写 SVG 面积图，零图表库 |
| G6 图谱引擎 | `components/ontology-graph/`（use-g6-graph 932 + styles 903 + types 64 行） | 纯前端引擎，换数据源即可；我方现用 echarts，可评估替换/并存 |
| 壳层与路由骨架 | `components/app-shell/`（984 行，含 ⌘K 命令面板、租户切换、侧栏拖拽）、`App.tsx`、`routes/index.tsx`、`with-app-shell`、`RouteAccess` | 结构照搬，权限码换我方 |
| 枚举→中文 label/tag 映射表 | `material-status.ts`、`kb-meta.ts`、`graph-meta.tsx` | 直接抄 |

### 4.2 必须重写（与后端契约/平台强耦合）

* 全部 `src/services/*.ts`（51 个文件）：路径 `/future-brain/v1/...`、`ApiEnvelope` 解包、`PageResult{records,total,size,current}`、`X-Tenant-Code` 语义。
* `services/http.ts`：baseURL `/kapi`、错误码 `101012001`、登录失效跳转 —— 换我方 `/api/kb` + 我方鉴权。
* 鉴权/权限体系：`AuthProvider`、`canAccess`、apex 登录跳转 —— 我方走主壳 SSO 体系。
* SSE 问答：`streamAiChat` 事件协议（meta/token/tool_result/done/error）—— 我方 `ChatController` 是同步返回，需先定是否改流式。
* 编译流水线 UI：`task-manager.tsx`（1511 行）、`observability.tsx`、`material-compilation-section.tsx`、`task-config-panel.tsx` 绑定参考仓 P0–P4 阶段模型与 M1/M2 里程碑 —— 我方要先有自己的阶段模型。
* 知识库/资料状态机：参考仓枚举取值与后端一一对应，我方换枚举即崩。

### 4.3 不迁移

* `pages/ontology-graph/`、`pages/ontology-modeling/`：依赖外部图库 `galaxy-meta-admin`（nGQL / Space 元数据），我方无此图库 —— 归 `z-ontology`。
* `pages/ai/monitor/`、`pages/ai/metrics/`：纯 mock，无后端。

## 5. 已知坑（抄的时候别踩）

1. 参考仓 `doc/coding-standards.md` 引用的 `src/components/use-resizable-columns.ts` **不存在**；`AGENTS.md` 列的 `src/types/domain.ts`、`src/layout/`、`src/pages/mobile/` 也**不存在** —— 文档与代码已脱节。
2. 参考仓 `services/` 的租户头是**每个 service 手写** `tenantHeaders()`，抄的时候极易漏；我方应在拦截器统一注入。
3. 参考前端无全局状态库（无 redux/zustand/react-query），靠页面级 controller hook + CustomEvent + localStorage —— 这个「每页一个 controller hook」的模式值得照抄，与我方后端改造耦合最低。
4. 我方 `_doc/001_arch/00-overview.md` 写的技术栈（Java 8 / Spring Boot 2.7.18 / z-kb 1.0.7 / React 18 + antd 5）**已过期**，实际为 Java 17 / Spring Boot 3.3.13 / 1.1.0 / React 19 + antd 6 —— 本轮一并订正。
