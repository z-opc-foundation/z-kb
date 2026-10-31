# z-kb

> 知识库服务 —— 接入（9 种数据源）→ 索引（解析 / 分块 / 嵌入 / 实体关系抽取）→ 检索（向量 + BM25 + 图谱三路召回，RRF 融合）→ RAG 问答。

z-opc 基座的自托管知识库：文档可从语雀 / Notion / Confluence / 飞书 / 钉钉 / Git 仓库 / 本地目录 / URL /
Webhook 进入 `IngestPipeline`，经 `MarkdownParser → Chunker → EmbeddingProvider` 落到
z-vector 向量库与图谱存储，`HybridSearcher` 做五模式检索，`DefaultChatService` 提供会话式问答
（未配 LLM 时走离线抽取式回答）。既可以 `z-kb-spring-boot-starter` 嵌入宿主应用，
也可以用 `z-kb-bootstrap` 独立启动，配 React 管理前端 `z-kb-frontend`。

---

## 📋 基本信息

| 字段 | 值 |
|------|-----|
| **仓库** | `z-kb` |
| **Maven 坐标** | `io.github.yuku123:z-kb:1.1.0`（直接 `<version>`，非 `${revision}`；flatten-maven-plugin 1.5.0 `oss` 模式常开） |
| **父项目** | `io.github.yuku123:z-boot-parent:1.2.0`（`<relativePath/>` 留空）；父链自带第三方地板与兄弟仓权威表（`z-boot-dependencies` / `z-boot-fleet` 两个文件夹随 2026-10-08 火车制拓扑退役） |
| **Maven Central** | 最新**已发布**仍是 `1.0.7`（2026-10-06 发布）：`z-kb` 及 api/core/vector/graph/storage/protocol/spring-boot-starter/ingest/modeling/resource/web 共 12 支坐标；11 个 jar 模块 pom/jar/**sources**/**javadoc** 四件齐全（根 `z-kb` 为 pom 打包，只要 pom + 签名）。`z-kb-resource`（资源域）是仓内新增模块，尚无 Central 发布版本。历史：`1.0.5`/`1.0.6` 的 `z-kb-protocol` 缺 sources/javadoc（该模块当时无源码，已在 `1.0.7` 实现）；`z-kb-bootstrap` 中央只有 `1.0.1`。**`1.1.0`（2026-10-22）仓内版本号与公告已就位，但尚未发到中央** —— 发中央属「对外发布」的人工保留项，详见 [`_doc/006_release/02-1.1.0-breaking-change.md`](_doc/006_release/02-1.1.0-breaking-change.md) |
| **默认端口** | `8889`（`z-kb-bootstrap/src/main/resources/application.yml`，context-path `/`）；starter 嵌入时随宿主应用端口 |
| **运行口径** | Java 17（产物 class-file 61）· Spring Boot 3.3.13（父链下发；2026-10-30 起各模块 POM 的 `2.7.12` 字面量已全部清掉，版本一律由父链 DM 下发） |
| **最近更新** | 2026-10-31 |

---

## 🎯 能力清单（全部对应到代码里的类）

| 能力 | 实现 | 所在模块 |
|------|------|----------|
| 多源接入 | `IngestPipeline` + `DataSourceRegistry`，内置 9 种 `DataSource`：`YuqueSource` / `NotionSource` / `ConfluenceSource` / `FeishuSource` / `DingtalkSource` / `GitSource` / `LocalDirSource` / `UrlSource` / `WebhookSource` | z-kb-ingest |
| Markdown 解析 | `MarkdownParser` / `FrontmatterParser` / `WikilinkExtractor`（双链） | z-kb-core |
| 分块 | `Chunker`（token 口径：max-tokens / overlap-tokens / min-tokens） | z-kb-core |
| 向量化 | `TfIdfEmbeddingProvider`（离线默认）/ `HttpEmbeddingProvider`（OpenAI 兼容端点，可指 Ollama 等） | z-kb-core |
| 实体 / 关系抽取 | `EntityExtractor`（词典 + 词频 + wikilink 的轻量混合策略，非深度学习 NER）/ `RelationExtractor` | z-kb-core |
| 检索 | `Bm25Searcher` + `HybridSearcher`（向量 / BM25 / 图谱三路召回，RRF 融合）；`SearchMode` = VECTOR / KEYWORD / GRAPH / HYBRID / FUSION | z-kb-core |
| 库内 dense 检索（v1） | `KnowledgeRetrievalService`：本地哈希向量（384 维、中文二元组、FNV-1a）、只保留当前物料版本、按需回填向量；命中带得分、命中词、解释与章节上下文 | z-kb-core / z-kb-resource |
| RAG 问答 | `DefaultChatService`：检索 + 引用返回；`zkb.chat.endpoint` 留空或 LLM 调用失败时回退抽取式回答；会话管理（createSession / chatInSession / getHistory） | z-kb-spring-boot-starter |
| 知识建模 | `ModelingService.decompose` → `ProductModel` → `CheatSheet`（`ProductDecomposer` / `CausalChainExtractor` / `CheatSheetGenerator`） | z-kb-modeling |
| 工作台隔离 | `Workspace` + 各服务按 workspace 分区；`listEntities` / `getNeighbors` / `getSubgraph` 图谱查询 | z-kb-api / starter |
| REST API + 在线文档 | 25 个 Controller（见下文）+ springdoc 2.6.0 / OpenAPI 3（DTO 注解为 `@Schema` / `@Operation` / `@Tag`） | z-kb-web |
| 知识库资源域 | 知识库生命周期（创建 / 归档 / 恢复 / 移除）、成员 ACL（角色矩阵 + 创建者保护 + 末位管理员保护）、配置版本（草稿 → 校验 → 发布）与审计日志；持久化走 MyBatis-Plus + 显式 `tenant_code` 谓词 | z-kb-resource / z-kb-storage |
| 物料域 | 物料 / 版本 / 解析稿 / 回收站 / 三层分类树 / 原件存储 SPI（默认 `LocalKbOriginalFileStore`）；sha256 去重，原件与解析正文分开存 | z-kb-resource / z-kb-storage |
| 编译域 | `CompilationService` + `CompilationBatchService`：P0–P4 阶段（REGISTER / PARSE / CHUNK / INDEX / EXTRACT）、M1 / M2 里程碑、产物登记簿与不可变产物版本、检索块、编译组别（多文件共用作业 + 同库运行锁） | z-kb-resource / z-kb-storage |
| 本地规则萃取 / 概念模型 / 图谱 | `ExtractionEngine`（摘要 / 问句 / 术语 / FAQ + 物料与概念节点、MENTIONS / RELATED_TO 边，全规则化不调 LLM）→ P4 落库；`ConceptNames` 按归一化名称在库内归并概念（出现次数 / 来源物料数 / EMERGING→CONFIRMED）；`ExtractionService` / `ConceptService` / `GraphService` 查询 | z-kb-core / z-kb-resource / z-kb-storage |
| Wiki 产物域 | `WikiService`：按已解析正文规则切分要点（`WikiPageBuilder`，单页 ≤50 点 / 单点 ≤1200 字）、按物料版本幂等建页与升版、Agent 产物按页面标识幂等写入并物理清理过期页、来源记录与「物料 → Wiki → 图谱节点」血缘；`WIKI_DOC` 产物登记进产物簿（内容哈希去重）；编译入口请求内同步返回终态任务句柄 | z-kb-core / z-kb-resource / z-kb-storage |
| 评测域 | `EvaluationService`：QA 集合版本化（草稿 → 冻结）、同步本地确定性跑批（QASet / 配置 / Judge / 快照 / 索引代际五要素指纹，2 小时内同口径复用）、S1–S8 阶段追踪、30 条四层指标（核心 / 前置 / 诊断 / 运行时）、坏例台账（OPEN / FIXING / FIXED / REGRESSED）、基线对比与五类可信证据；向量在评测时按正文现算，不回写检索块 | z-kb-core / z-kb-resource / z-kb-storage |
| 接入源域 | `KnowledgeBaseSourceService` + `IngestService`：接入源全量覆盖保存（≤20 个、凭据脱敏视图、沿用旧凭据）、连通性测试（语雀 `/user`、Git 项目）、语雀目录与目录文档、同步摄入（语雀 TOC ∪ 文档列表取白名单、Git 一仓一条物料、按版本号两级增量、失踪文档清退、旧版按文件登记的 GIT 物料首同步后清退），落库复用物料域 `syncUpsert` | z-kb-core / z-kb-resource |

### 索引流水线（代码实测）

`DefaultKnowledgeBaseService.indexDocument(IndexRequest)` 依次执行：解析（MarkdownParser，含 frontmatter 与
wikilink）→ `Chunker` 分块 → `EmbeddingProvider` 向量化并写 `ChunkVectorStore`（集合名固定 `kb_chunks`，
所有 workspace 共用）→ `EntityExtractor` / `RelationExtractor` 写 `KnowledgeGraphStore` →
`DocumentRepository` 落元数据。文档状态机 `DocumentStatus`：
`CREATED / PARSING / CHUNKING / EMBEDDING / INDEXED / FAILED / DELETED`。

### 存储后端（自动装配实际接线的）

| 接口 | 默认实现 | 备选 | 配置键 |
|------|----------|------|--------|
| `DocumentRepository` | `JsonFileDocumentRepository`（默认 `~/.zkb/zkb.json`） | `InMemoryDocumentRepository` | `zkb.storage.path` |
| `ChunkVectorStore` | `ZVectorChunkVectorStore`（包装 z-vector `VectorStore`；`storage-type=persistent`（**1.1.0 起的默认**）反射加载 `PersistentVectorStore`（默认 `~/.zkb/vector`），**装不上就启动失败并给修复指引，不再静默回退内存**） | `storage-type=in-memory` ⇒ `InMemoryVectorStore` | `zkb.vector.storage-type` / `data-dir` / `dimension` / `index-type` / `metric` |
| `KnowledgeGraphStore` | `ZGraphKnowledgeGraphStore`（**1.1.0 起的默认**，走 z-graph 引擎 `com.zifang.z.graph.core.InMemoryGraphStore`；**进程内图谱，重启不保留**） | `zkb.graph.engine=json` ⇒ `JsonFileKnowledgeGraphStore`（默认 `~/.zkb/graph`，重启不丢数据） | `zkb.graph.engine` / `zkb.graph.path` |

三个后端的**本地状态目录**在 1.1.0 统一收敛到 `~/.zkb/`（`vector/` / `graph/` / `zkb.json`），
且三个路径配置项都支持 `~` 展开（写 `~/data/zkb` 会被展开成 `/home/<用户>/data/zkb`，
而不是在当前目录下造一个名叫「~」的目录）。

注意：`z-kb-storage` 的 POM 虽声明了 MyBatis-Plus / mysql-connector-j / H2，但仓内**没有** JDBC 版
`DocumentRepository` 实现；生产接 MySQL 需按该类注释自行注册覆盖 Bean。JDBC 持久化目前只用于
**资源域**（`z-kb-storage` 的 `resource` 包：5 张表 + Mapper + `KbSchemaInitializer` 自动建表）。

---

## 🛑 1.1.0 破坏性变更公告（D1 拍板：默认值翻转显式发布，不搞静默切换）

**引擎一行没改，改的是装配与文档**；变更点与「怎么显式回旧档」：

| 项 | 旧默认（1.0.x） | 新默认（1.1.0） | 显式回旧档 |
|---|---|---|---|
| 向量存储 | `in-memory`（内存，重启丢） | `persistent` ⇒ `PersistentVectorStore`（落盘，重启不丢） | `zkb.vector.storage-type=in-memory` |
| 持久化向量装不上时 | **静默回落**内存向量（服务照常起、数据悄悄不落盘） | **启动失败**，错误信息带修复指引 | 无（这正是本次要改的行为） |
| 图谱存储 | `JsonFileKnowledgeGraphStore`（JSON 文件，重启不丢） | `ZGraphKnowledgeGraphStore`（z-graph 引擎，**进程内图谱，重启不保留**） | `zkb.graph.engine=json` |
| 图谱引擎开关 | 无 | 新增 `zkb.graph.engine`（`zgraph` 默认 / `json`） | `zkb.graph.engine=json` |
| 本地状态目录 | 向量 `./data/zvector`（相对 CWD）／图谱 `~/.zkb/graph`／文档 `~/.zkb/zkb.json` | 统一 `~/.zkb/`：`vector/`、`graph/`、`zkb.json` | `zkb.vector.data-dir` / `zkb.graph.path` / `zkb.storage.path`（均支持 `~` 展开） |
| `dev` profile | 无专门口径 | **回落成 1.0.x 默认口径**：内存向量 + JSON 图谱（对齐 z-lc 的 dev H2 家族惯例） | — |

**消费方（z-opc 等）升级三件事**：

1. **确认 data-dir 可写** —— 向量默认落 `~/.zkb/vector`；容器里没有可写 HOME / 没挂卷 ⇒ 启动会失败
   （失败要响是本次的立意）。显式指路：`zkb.vector.data-dir=/data/zkb/vector`。
2. **图谱默认从「JSON 文件」变成「进程内 z-graph」⇒ 重启后图谱不保留**；要保留请显式
   `zkb.graph.engine=json`（存量 JSON 文件原地继续读写，无需迁移）。
3. **依赖树多了 `io.github.yuku123:z-vector-storage`**（`PersistentVectorStore` 所在坐标）⇒ fat jar 体积变化。

完整公告与取证清单见 [`_doc/006_release/02-1.1.0-breaking-change.md`](_doc/006_release/02-1.1.0-breaking-change.md)。

**图谱文件名怎么来的**：`JsonFileKnowledgeGraphStore` 是一工作台一份 JSON，文件名是 workspace 名的
**可逆转义**（合法字符原样保留，其余编成 `~` + 两位大写 hex），所以中文、含 `.` / `:` / 空格的工作台名
都各自落到不同文件——旧实现是把非法字符一律压成同一个下划线，`默认空间` 与 `生产环境` 会算出同一个文件名
并互相覆盖，重启后其中一个工作台的图谱整体消失且不报错。现在编码是单射，且本来就能当文件名的
workspace（`team_a` 这类）编码后一字不变，存量文件继续原地读写、无需迁移。

---

## 🏗️ 项目结构

```
z-kb/
├── pom.xml                      # 聚合 POM：继承 z-boot-parent:1.2.0，自家 11 坐标 DM 钉 ${project.version}
├── z-kb-api/                    # SPI 接口 + 领域模型（ChatService / SearchService / KnowledgeBaseService /
│                                #   EmbeddingProvider / ChunkVectorStore / KnowledgeGraphStore / DocumentRepository /
│                                #   资源域契约（KnowledgeBaseResourceService / MemberAdmin / ConfigService）/
│                                #   物料域契约（MaterialService / CategoryService / RepoBrowseService / 解析与原件存储 SPI）/
│                                #   编译域契约（CompilationService / CompilationBatchService）/ 检索域契约（KnowledgeRetrievalService）/
│                                #   萃取与图谱契约（ExtractionService / ConceptService / GraphService）/
│                                #   任务与观测契约（OverviewService / AuditLogService / TaskConfigService / KbTaskConfigService /
│                                #   TaskMonitorService）/ Wiki 域契约（WikiService 等）与 Wiki 计数 SPI（WikiPageCounter）/
│                                #   评测域契约（EvaluationService 与数据集 / 运行 / 指标 / 坏例 / 可信证据视图）/
│                                #   接入源域契约（KnowledgeBaseSourceService / IngestService 与来源视图 / 同步回执）等 217 个类）
├── z-kb-core/                   # 解析 / 分块 / 嵌入（TF-IDF、HTTP）/ BM25 + 混合检索 / 实体关系抽取
├── z-kb-vector/                 # z-vector 适配：ZVectorChunkVectorStore + ChunkVectorStoreAutoConfiguration
│                                #   （1.1.0 起默认 persistent：PersistentVectorStore，装不上即启动失败）
├── z-kb-graph/                  # 图谱存储：ZGraphKnowledgeGraphStore（1.1.0 默认，z-graph 引擎）+ JsonFileKnowledgeGraphStore
├── z-kb-storage/                # 文档仓库：JsonFile（默认）/ InMemory + 自动装配
├── z-kb-protocol/               # 协议层：REST 请求/响应 DTO + OpenAPI 契约注解（1.0.7 起有源码）
├── z-kb-ingest/                 # 9 种数据源 + IngestPipeline + HtmlToMarkdown
├── z-kb-modeling/               # 工作台 → 产品模型 → 小抄
├── z-kb-spring-boot-starter/    # KBAutoConfiguration + KBProperties（前缀 zkb.*）+ Default{Chat,Search,KnowledgeBase}Service
├── z-kb-resource/               # 知识库资源域：生命周期 / 配置版本（草稿→校验→发布）/ 成员 ACL / 审计（JDBC 持久化）
├── z-kb-web/                    # REST 层：25 个 Controller + SwaggerConfig（springdoc GroupedOpenApi），纯 jar，不内置前端静态资源
├── z-kb-bootstrap/              # 独立启动器（ZKbBootstrapApplication，端口 8889）。已从 <modules> 注释排除：
│                                #   standalone uber-jar 约 77MB 触发 Maven Central 上传 broken pipe；其 pom 仍停在 1.0.1
├── z-kb-frontend/               # 独立 npm 工程（React 19 + antd 5.26 + @antv/g6 5 + Vite 6 + TS，非 Maven 模块）
├── _doc/                        # 文档目录（见文末）
└── LICENSE                      # MIT
```

reactor 实际参与构建的是 11 个模块（`z-kb-bootstrap` 被注释排除）。各库模块自带
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
注册自己的自动装配；starter 只注册 `KBAutoConfiguration` 一个入口。

---

## 🔧 技术栈（POM 实测）

| 层级 | 技术 |
|------|------|
| 语言 / 运行时 | Java 17（地板 `java.version=17`；实测产物 class-file **61**，Java 8 时代的 52 已不再适用） |
| 框架 | Spring Boot 3.3.13 + Spring Framework 6.1.21（经 `z-boot-parent:1.2.0` 下发；2026-10-30 起各模块 POM 不再字面写 `2.7.12`） |
| 兄弟仓依赖 | `z-vector-api/core`、`z-vector-storage`（1.1.0 新增：`PersistentVectorStore` 所在坐标，父链 DM 不管这一格 ⇒ 本仓自己钉 1.0.5）、`z-graph-api/core`、`z-util-core/ch/http` —— 均无字面版本，由 `z-boot-parent` 的兄弟仓权威表下发（repo1 实测面值：z-vector 1.0.5 / z-graph 1.0.8 / z-util 1.0.14）。本仓 POM 中**没有** z-llm 依赖 |
| 本仓刻意覆盖 | Jackson 2.15.4（地板 2.18.6）、`swagger-annotations-jakarta` 2.2.22（OpenAPI 契约注解；必须 ≥2.2.6，否则 `Schema.RequiredMode` 不存在）、log4j-api 2.22.1、mysql-connector-j 8.0.33、mybatis-spring 3.0.4（Spring 6.1 下 `@MapperScan` 要求 ≥3.0.3，2.1.2 会报 `factoryBeanObjectType` 类型错） |
| 其它父链不供 | H2 2.2.224、jsoup 1.18.1、slf4j 2.0.13、junit-jupiter 5.10.2（test）；`hanlp.version=1.8.6` 属性已定义但仓内零引用（`HanLpTokenizer` 是仓内正则/词典自实现，不依赖 HanLP 库） |
| 前端 | React 19.1 + antd 5.26 + react-router 7 + @antv/g6 5.1 + ag-grid 36 + pdfjs-dist / docx-preview / pptx-preview + Vite 6（TypeScript 5.8，Node ≥20，`.nvmrc` 钉 20） |
| 构建 | Maven + flatten-maven-plugin 1.5.0（`oss` 常开）；`central` profile 走 central-publishing-maven-plugin 0.7.0 + GPG + sources/javadoc |

---

## 🚀 快速开始

### 编译

```bash
mvn clean install -DskipTests
```

版本口径由 `z-boot-parent:1.2.0` → 地板 + fleet 供给，构建机需能解析
`io.github.yuku123:z-boot-parent:1.2.0`（repo1 或本地仓）。

### 嵌入宿主应用（Spring Boot Starter）

```xml
<dependency>
    <groupId>io.github.yuku123</groupId>
    <artifactId>z-kb-spring-boot-starter</artifactId>
    <version>1.1.0</version>
</dependency>
```

配置前缀是 **`zkb.*`**（不是 `z.kb.*`）。最小离线可用配置（不需要任何 API Key）：

```yaml
zkb:
  enabled: true
  embedding:
    provider: tfidf        # tfidf（默认，离线）/ http（OpenAI 兼容端点）
    dimension: 512
  chunker:
    max-tokens: 256
    overlap-tokens: 80
    min-tokens: 32
  chat:
    # endpoint/model/apiKey 全留空 = 抽取式回答；填 OpenAI 兼容端点即走 LLM 生成
    system-prompt: 你是 z-kb 知识库助手……
```

| 配置键 | 说明 |
|--------|------|
| `zkb.embedding.provider` / `endpoint` / `model` / `api-key` / `dimension` | `http` 时对接 OpenAI 兼容 embeddings 端点（如 Ollama） |
| `zkb.vector.storage-type` / `data-dir` / `index-type` / `metric` | **persistent（1.1.0 默认，落 `PersistentVectorStore`）/ in-memory**；HNSW + COSINE 口径；`data-dir` 默认 `~/.zkb/vector`（支持 `~` 展开） |
| `zkb.graph.engine` / `zkb.graph.path` | **zgraph（1.1.0 默认，走 z-graph 引擎）/ json**（JSON 文件持久化）；`path` 默认 `~/.zkb/graph` |
| `zkb.storage.path` | 文档 JSON 位置（默认 `~/.zkb/zkb.json`，支持 `~` 展开） |

**API Key 等凭据必须经环境变量注入**（Spring relaxed binding，如 `ZKB_CHAT_API_KEY`、
`ZKB_EMBEDDING_API_KEY`），禁止写进 yml / jar / 镜像层。

### 独立启动

唯一入口是 `z-kb-bootstrap` 的 `ZKbBootstrapApplication`（component-scan `com.zifang.z.kb`）。
该模块当前不在 reactor（见项目结构说明），POM 停在 1.0.1；默认监听 **8889**，
Knife4j 文档在 `http://localhost:8889/doc.html`，Actuator 暴露 `health,info,metrics`。

### 管理前端

```bash
cd z-kb-frontend
npm install
npm run dev      # scripts/dev.mjs，Vite 监听 5173（strictPort，host 0.0.0.0）
```

要求 Node ≥20（`.nvmrc` 钉 20）。代理契约：`/kapi/future-brain/v1/*` → `http://127.0.0.1:8889/api/kb/v1/*`
（`KB_API_TARGET` 可覆盖后端地址），并由代理注入 `X-Tenant-Code`（默认 `future_hospital`，`KB_TENANT_CODE` 覆盖）
与 `X-Actor-Id`（默认 `1`，`KB_ACTOR_ID` 覆盖），与后端 `KbCallerResolver` 直接对齐——本地无 SSO 会话也能联调。
其余前缀（`/kapi`、`/galaxy-meta-service`、`/galaxy-meta-admin`、`/apex-spc`）统一指向同一本地后端，
z-kb 未提供的端点如实 404、页面按失败态展示，不做静默兜底。

页面（`src/routes/index.tsx`，24 条路由 / 9 个页面域）：首页、系统导览、知识管理（列表 / 详情 / 设置 / 版本管理）、
知识评测、智能管理（agents / skills / tools / 调用监控 / 技术指标）、系统管理（系统监测 / 权限 / 审计日志 /
调度配置 / 任务配置 / 租户 / 配额）、本体概览、本体建模、图谱工作台（@antv/g6 5）。
其中 `src/services/ontology-graph.ts` 是服务层适配：参考仓的 NebulaGraph 代理契约（spaces / metadata / nGQL / STATS）
改走 z-kb 的 `GET /api/kb/v1/graph/queryByKb`，由节点与边实时推 schema、计数与统计时间；页面、组件与导出类型字面不变，
nGQL 实例查询显式返回不支持原因（z-kb 图谱引擎是本地规则图谱）。

验证矩阵：`npm run typecheck`（`tsc -b`）、`npm test`（vitest，161 个测试文件 / 871 条用例）、
`npm run build`、`npm run lint`（`--max-warnings 121`）。
Node ≥22 自带 `localStorage` 全局（未传 `--localstorage-file` 时取值 `undefined`），会让 vitest 的
`populateGlobal` 跳过 jsdom 实现；`src/test/setup.ts` 里有一条仅在全局值缺失时生效的回接，Node 20 上为 no-op。

---

## 🔌 API 一览（z-kb-web，25 个 Controller 实测）

### 资源域 v1（`/api/kb/v1/*`，对齐 future-brain 契约）

统一信封 `KbResult`：`{success, code, message, data}`；成功 `code=0`、`message="ok"`，
失败时 HTTP 状态与 `code` 同为 400/403/404/409/500，`data` 恒存在（空对象）以免 `NON_NULL` 序列化吞键。
调用方身份由 `KbCallerResolver` 解析（默认实现读 `X-Tenant-Code` / `X-Actor-Id` / `X-Actor-Name`，
宿主可注册自己的 Bean 改接 z-ctc 的租户上下文）。

| 路径 | Controller | 说明 |
|------|------------|------|
| `POST /api/kb/v1/knowledgeBase/page` | KnowledgeBaseController | 分页（排除已移除；可选含归档） |
| `GET /api/kb/v1/knowledgeBase/queryDetailById` | KnowledgeBaseController | 详情 + 当前调用者能力位 |
| `POST /api/kb/v1/knowledgeBase/add` / `update` / `archive` / `restore` / `remove` | KnowledgeBaseController | 生命周期（remove 仅限已归档） |
| `GET /api/kb/v1/knowledgeBase/queryConfig`、`POST …/saveConfigDraft`、`discardConfigDraft`、`validateConfigDraft`、`publishConfig` | KnowledgeBaseController | 配置版本：草稿 → 校验（差异 / 影响面）→ 发布（需 `confirm=true`） |
| `POST /api/kb/v1/knowledgeBase/activity` | KnowledgeBaseController | 审计热力图数据源（kbIds / days） |
| `GET /api/kb/v1/knowledgeBase/member/list` / `candidates` / `effective`、`POST …/member/grant` / `revoke` | KnowledgeBaseMemberController | 成员 ACL：角色矩阵、创建者不可降级 / 移除、至少保留一名管理员 |
| `POST /api/kb/v1/material/page` / `pageDeleted`、`GET …/queryDetailById` / `listRecent` | MaterialController | 物料分页 / 回收站 / 详情（版本 + 当前解析稿）/ 最近登记 |
| `POST /api/kb/v1/material/upload`（multipart）、`POST …/revise`、`GET …/download` | MaterialController | 上传登记（sha256 去重，100MB 上限）/ 追加新版本 / 下载原件 |
| `POST /api/kb/v1/material/remove` / `restore` / `purge`、`POST …/updateCategory` | MaterialController | 逻辑删除 / 回收站恢复 / 物理清除（版本、草稿、原件）/ 批量改分类（逐项返回） |
| `POST /api/kb/v1/material/reparse` / `saveDraftText`、`GET …/listDrafts` | MaterialController | 重新解析 / 人工改稿（`manual-edit`）/ 解析稿列表（新稿在前） |
| `POST /api/kb/v1/material/attachment` / `registerText` / `registerFromUrl` | MaterialController | 会话附件只落存储 / 文本登记为 `.md` / 按附件地址登记 |
| `GET /api/kb/v1/materialCategory/tree`、`POST …/add` / `update` / `move` / `remove` | MaterialCategoryController | 三层分类树；同层重名、成环、超深拒绝；有子分类或物料时禁止删除 |
| `GET /api/kb/v1/material/repo/overview` / `tree` / `file` | MaterialRepoController | 代码仓库物料只读浏览（读宿主本地检出根 `zkb.material.repo.root`） |
| `POST /api/kb/v1/compilation/run` / `retry` / `cancel` | CompilationController | 单文件编译：请求内同步执行 P0–P4、按起始阶段重跑（轮次 +1）、取消 |
| `GET /api/kb/v1/compilation/queryByMaterial` / `queryByJob` / `listByKb` | CompilationController | 按物料 / 作业查询编译详情，库内作业列表（未编译返回 `null`） |
| `GET /api/kb/v1/compilation/listChunks` / `search` | CompilationController | 物料段落块（`chunk_role=PASSAGE`）/ 库内已索引块词法关键词检索 |
| `POST /api/kb/v1/compilation/createBatch` / `cancelBatch`、`GET …/queryBatch` / `listBatches` / `pageBatches` / `hasRunningBatch` | CompilationController | 编译组别（多文件共用作业）：创建 / 取消 / 详情 / 列表 / 分页 / 运行锁 |
| `POST /api/kb/v1/knowledgeBase/retrieve` | KnowledgeRetrievalController | 库内 dense 检索：topK（≤50）/ minScore / mode=dense，返回分数、命中词、解释与章节摘录 |
| `GET /api/kb/v1/overview/kbStats` | OverviewController | 知识库概览聚合：物料 / 已编译 / 部分 / 未编译、Wiki 数、运行中与失败任务、最近 5 条物料 |
| `POST /api/kb/v1/auditLog/page`、`GET …/get` | AuditLogController | 租户内审计日志分页（关键词 / 类型 / 业务引用 / 操作人 / 结果 / 时间范围）与按主键详情 |
| `GET /api/kb/v1/taskConfig/query`、`POST …/publish` | TaskConfigController | 租户级任务配置：首访落预置版本 2026.10，整版发布升版（只影响之后创建的任务） |
| `GET /api/kb/v1/taskConfig/kb/query`、`POST …/kb/publish` | KbTaskConfigController | 库级任务配置：未覆盖的任务性质回落租户版本，发布独立升版并写审计 |
| `GET /api/kb/v1/taskMonitor/page`、`summary` | TaskMonitorController | 调度任务（编译阶段行）分页与「组别 / 单任务 / 调度任务」角标汇总 |
| `GET /api/kb/v1/extraction/queryByMaterial` | ExtractionController | 按物料回读 P4 萃取产物：摘要 / 问句 / 术语 / FAQ + 图谱计数 + 当前里程碑（M1 / M2 / NONE） |
| `GET /api/kb/v1/concept/listByKb`、`queryById` | ConceptController | 概念模型列表（名称关键词、按来源物料数与提及次数倒序、上限 200）/ 详情 + 来源提及（上限 100） |
| `GET /api/kb/v1/graph/queryByKb`、`queryByMaterial` | GraphController | 本地规则图谱：节点按名称、边按标识稳定排序，各上限 200（超限 `truncated=true`）；可按物料收窄 |
| `POST /api/kb/v1/wiki/generate` | WikiController | 为一批物料（≤100）生成规则 Wiki：逐条返回 READY / FAILED，单条失败不阻断其他资料 |
| `GET /api/kb/v1/wiki/list` / `listByMaterial` | WikiController | 按库列出（title / summary 关键词，条数默认 50、上限 100）/ 按物料列出（未生成返回空列表） |
| `GET /api/kb/v1/wiki/detail` | WikiController | 页面详情：要点正文、来源资料、本地规则图谱节点数与口径说明 |
| `GET /api/kb/v1/wiki/lineage` | WikiController | 血缘图：物料 → Wiki → 图谱节点 / 边（`SOURCED_FROM` 起头），按 wikiId 或 kbId 范围查询，图谱项各上限 500 |
| `POST /api/kb/v1/wiki/saveGenerated` / `GET …/queryGenerated` | WikiController | Agent 编译产物：按页面标识幂等写入多页（≤50）、刷新目录与块覆盖、物理清理过期页；按物料回读最近一次目录（未编译返回 `null`） |
| `POST /api/kb/v1/wiki/compile` | WikiController | 提交 Wiki 编译：z-kb 无任务内核，请求内同步生成规则页面并返回终态任务句柄（`WIKI_COMPILE` / `SUCCEEDED`） |
| `GET /api/kb/v1/evaluation/pageKnowledgeBase` | EvaluationController | 评测口径的库列表：数据集版本 / 最近跑批核心通过数 / 待处理坏例数与未接入项 |
| `GET /api/kb/v1/evaluation/queryOverview`、`queryDataset` | EvaluationController | 单库概览（当前数据集、最近跑批、基线、坏例统计、五类证据）/ QA 集合与题目（版本号缺省取最新冻结，再回落草稿） |
| `POST /api/kb/v1/evaluation/saveDatasetDraft`、`publishDataset` | EvaluationController | 一库一份草稿（≤200 题，覆盖重建用例）/ 冻结为可用版本（校验期望版本号） |
| `POST /api/kb/v1/evaluation/createRun` | EvaluationController | 同步本地确定性跑批：固定数据集 / 配置 / Judge / 快照 / 索引代际，2 小时内同口径自动复用（`allowReuse`） |
| `GET /api/kb/v1/evaluation/queryRun` | EvaluationController | 跑批详情、30 条四层指标、S1–S8 阶段状态、坏例统计与基线差值 |
| `POST /api/kb/v1/evaluation/pageCaseResults` | EvaluationController | 逐题结果分页，可按失败阶段或仅坏例筛选 |
| `GET /api/kb/v1/evaluation/listBadcases` | EvaluationController | 坏例台账：按状态（ALL / OPEN / FIXING / FIXED / REGRESSED）与阶段过滤；只归因，不改产物 |
| `GET /api/kb/v1/evaluation/queryTrustEvidence` | EvaluationController | 版本 / 覆盖 / 评分 / 逐题 / 复现五类可信证据（`items` 形状） |
| `POST /api/kb/v1/evaluation/updateBadcase` | EvaluationController | 坏例状态流转（OPEN / FIXING → FIXED），再次出现自动转 REGRESSED |
| `GET /api/kb/v1/knowledgeBaseSource/list` | KnowledgeBaseSourceController | 接入源列表（凭据脱敏：只回 `hasSecret`，不回明文） |
| `POST /api/kb/v1/knowledgeBaseSource/save` | KnowledgeBaseSourceController | 全量覆盖保存（≤20 个、名称 ≤100、分类与凭据类型归一；改名留空凭据沿用旧值） |
| `POST /api/kb/v1/knowledgeBaseSource/test` | KnowledgeBaseSourceController | 连通性测试：语雀发 `/user`、Git 发项目查询；不支持的供应商如实返回 |
| `POST /api/kb/v1/knowledgeBaseSource/yuque/catalog`、`…/yuque/catalogDocs` | KnowledgeBaseSourceController | 语雀知识库目录与目录文档（缺令牌返回提示消息，不抛错） |
| `POST /api/kb/v1/knowledgeBaseSource/sync` | KnowledgeBaseSourceController | 同步摄入：语雀 TOC ∪ 文档列表取白名单、Git 一仓一条物料；按版本号增量，失踪文档清退；回执带 created / updated / unchanged / retired / failed 计数 |

> **与参考实现的三处已知差异**（有意为之，不是缺件）：  
> ① 解析在登记事务内**同步**完成，`parseStatus` 直接返回真实的 `READY` / `FAILED`；参考实现是异步任务，登记后先返回 `PARSING`。  
> ② 原件存储走 `KbOriginalFileStore` SPI，默认实现 `LocalKbOriginalFileStore` 落本地磁盘（`zkb.material.storage.root`，默认 `~/.zkb/material-original`）；接 OSS/S3 需宿主提供同名 Bean 覆盖，仓内**没有**已实现的 OSS 客户端。  
> ③ 编译阶段同样在请求内同步执行（z-kb 无任务内核），状态机 / 里程碑 / 产物登记口径与参考一致；P4 EXTRACT 调用 `ExtractionEngine` 做本地规则萃取，摘要 / 问句 / 术语 / FAQ、概念模型与图谱按物料版本覆盖落库（阶段 `detail` 汇报各类型条数与节点/边数），全程不调 LLM。

### 既有 `/api/kb/*`（沿用原 `{status, code, message}` 响应形状）

| 路径 | Controller | 说明 |
| `POST /api/kb/chat` | ChatController | 单次问答（检索 + 回答 + 引用） |
| `/api/kb/chat/sessions[/{id}]`（POST/GET/DELETE）、`POST /api/kb/chat/sessions/{id}/chat` | ChatController | 会话管理与会话内多轮问答 |
| `POST /api/kb/documents`、`POST /api/kb/documents/markdown`、`POST /api/kb/documents/batch` | DocumentController | 文档索引 / Markdown 导入 / 批量导入 |
| `/api/kb/documents/{workspace}[/{id}]`、`/by-tags`、`/count`、`POST …/reindex`、`DELETE …/{id}` | DocumentController | 查询、按标签、重索引、删除 |
| `POST /api/kb/search` | SearchController | 统一检索（workspace 缺省 `default`，topK 缺省 10） |
| `GET /api/kb/graph/{workspace}/entities[/{name}][/neighbors]`、`POST …/subgraph` | GraphController | 实体、邻居、子图查询 |
| `POST|GET /api/kb/workspaces`、`GET /{name}`、`GET /{name}/statistics` | WorkspaceController | 工作台管理与统计 |
| `GET /api/kb/ingest/sources`、`POST /run`、`POST /submit`、`POST /webhook`、`POST /webhook/flush`、`GET /stats` | IngestController | 数据源列表、同步执行 / 异步提交、Webhook 灌入与刷写、统计 |
| `GET /api/kb/modeling/decompose`、`POST|GET /api/kb/modeling/cheatsheet` | ModelingController | 产品模型拆解与小抄生成 |

---

## 🧪 测试

```bash
mvn test
```

测试代码是有的 —— **8 个模块共 35 个测试文件**（`find . -path '*/src/test/*' -name '*.java'` = 37，
含 README 自守卫 1 个与 `*IT` 命名的 `GenerationEvalIT` 1 个）。
根 POM 的 `<dependencies>` 给全仓供 `junit-jupiter` + `junit-vintage-engine`（test 作用域，子模块自动
继承，子模块一律不再各自声明 junit），所以在根目录 `mvn test` 直接可跑。

> **计数口径（读表前先看这句）**：下面的「测试文件 / 实跑用例数」是
> **2026-10-31 的实测快照**，口径是 `find . -path '*/src/test/*' -name '*.java'`，
> **排除本仓 README 自守卫测试 `ReadmeClaimsTest`** —— 该守卫在 `z-kb-core`（自带 3 个用例），
> 所以表里的数说的是「守卫之外」的盘面。
> 守卫本身（`z-kb-core/src/test/java/com/zifang/z/kb/core/ReadmeClaimsTest.java`）负责把本 README 里的
> 定量主张（类数 / Controller 数 / 数据源数 / 模块数 / 版本号 / 端口）与源码对齐：README 改了就红。

`mvn -o -B -ntp clean test` 实测（2026-10-31，全部 0 失败 / 0 错误 / 0 跳过；口径同上，排除自守卫）：

| 模块 | 测试文件 | 实跑用例数 |
|---|---|---|
| `z-kb-protocol` | 1 | 18 |
| `z-kb-web` | 12 | 48 |
| `z-kb-core` | 9 | 31 |
| `z-kb-storage` | 2 | 11 |
| `z-kb-spring-boot-starter` | 3 | 12 |
| `z-kb-graph` | 1 | 4 |
| `z-kb-vector` | 1 | 1 |
| `z-kb-resource` | 6 | 22 |
| **合计** | **35** | **147** |

两点要说清：

- 35 个文件里 31 个是测试类，另 4 个是测试替身（`z-kb-core` 的 `EvalSuite` / `InMemoryVectorStore`、
  `z-kb-resource` 的 `KbResourceTestApplication`、`z-kb-web` 的 `KbApiTestApplication`，均不含 `@Test`）。
- `z-kb-resource` 与 `z-kb-web` 的集成测试跑真 Spring 容器 + H2（`MODE=MySQL`），不 mock Mapper。
- `z-kb-spring-boot-starter` 的第 3 个测试文件是 `KbAssemblyDefaultContractTest`（1.1.0 装配口径契约：
  默认 persistent + z-graph、data-dir 不可写即启动失败、dev profile 回落对照）。
- `z-kb-core` 的 `GenerationEvalIT` 是 `*IT` 命名，**surefire 默认 include 不收它** ⇒ 上面那 147 条
  **不含**它那 2 条。要跑得显式点名，且它整类被 `@EnabledIfEnvironmentVariable(EVAL_LLM_ENDPOINT)`
  门控 —— 不配真 LLM 端点时是 skipped（实测 `Tests run: 1, Skipped: 1`）：

```bash
mvn -pl z-kb-core -am test -Dtest=GenerationEvalIT -DfailIfNoTests=false
```

旧 README 的"421 单元 / 87 集成测试 PASS"与盘上代码对不上，已删除。功能验证另有两条路：
启动后走 Knife4j（`/doc.html`）与 `z-kb-frontend` 页面。

---

## 🐳 部署与发布

仓内**没有** Dockerfile / docker-compose / k8s / Makefile（旧 README 的 Docker Compose 示例为虚构，已删除）。
唯一运维脚本是 Maven Central 发布：

```bash
_doc/003_script/deploy_maven_center.sh publish   # mvn deploy -Pcentral
_doc/003_script/deploy_maven_center.sh verify    # 校验中央可搜到 io.github.yuku123
_doc/003_script/deploy_maven_center.sh gpg-init  # 首发前生成 GPG 密钥
```

凭据全部从 `.env` 读取（已在 `.gitignore` 内）。

---

## 📄 License

MIT，见根 [`LICENSE`](LICENSE)；根 POM `<licenses>` 同声明。

---

## 文档目录

本项目文档统一收口在 `_doc/` 下（八类固定编号表，桶按需存在）:

- [`_doc/001_arch/`](_doc/001_arch/) — 架构、接口、DB schema、协议、路线图
  - [`00-overview.md`](_doc/001_arch/00-overview.md) — 项目总览：模块架构、核心功能、对外集成、技术特点、目录结构
- [`_doc/003_script/`](_doc/003_script/) — 运维脚本:
  - [`deploy_maven_center.sh`](_doc/003_script/deploy_maven_center.sh) — Maven Central 一键发布 / 校验 / GPG 初始化
- [`_doc/006_release/`](_doc/006_release/) — 发布与中央仓文档（Central 缺件欠账与清账结论）
  - [`01-verify-central-note.md`](_doc/006_release/01-verify-central-note.md) — z-kb-protocol 空壳模块与 Central 缺件欠账（已还清）
  - [`02-1.1.0-breaking-change.md`](_doc/006_release/02-1.1.0-breaking-change.md) — **1.1.0 破坏性变更公告**：默认 persistent + 默认 z-graph + fail-fast、消费方升级说明与取证清单

_Maintained by the z-opc-foundation organization._
