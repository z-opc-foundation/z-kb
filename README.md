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
| **Maven 坐标** | `io.github.yuku123:z-kb:1.0.5`（直接 `<version>`，非 `${revision}`；flatten-maven-plugin 1.5.0 `oss` 模式常开） |
| **父项目** | `io.github.yuku123:z-boot-parent:1.0.21`（`<relativePath/>` 留空）；父链 = 地板 `z-boot-dependencies:1.0.20` + 兄弟权威表 `z-boot-fleet:1.0.1` |
| **Maven Central** | 已发布（repo1 实测 200）：`z-kb` 及 api/core/vector/graph/storage/protocol/spring-boot-starter/ingest/modeling/web 共 11 支坐标均有 `1.0.5`；`z-kb-bootstrap` 中央只有 `1.0.1`（`1.0.5` 实测 404） |
| **默认端口** | `8889`（`z-kb-bootstrap/src/main/resources/application.yml`，context-path `/`）；starter 嵌入时随宿主应用端口 |
| **运行口径** | Java 8 · Spring Boot 2.7.18（父链下发；部分模块 POM 仍字面钉 spring-boot-* `2.7.12`） |
| **最近更新** | 2026-09-30 |

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
| RAG 问答 | `DefaultChatService`：检索 + 引用返回；`zkb.chat.endpoint` 留空或 LLM 调用失败时回退抽取式回答；会话管理（createSession / chatInSession / getHistory） | z-kb-spring-boot-starter |
| 知识建模 | `ModelingService.decompose` → `ProductModel` → `CheatSheet`（`ProductDecomposer` / `CausalChainExtractor` / `CheatSheetGenerator`） | z-kb-modeling |
| 工作台隔离 | `Workspace` + 各服务按 workspace 分区；`listEntities` / `getNeighbors` / `getSubgraph` 图谱查询 | z-kb-api / starter |
| REST API + 在线文档 | 7 个 Controller（见下文）+ Knife4j（springfox `DocumentationType.SWAGGER_2`） | z-kb-web |

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
| `ChunkVectorStore` | `ZVectorChunkVectorStore`（包装 z-vector `VectorStore`；`storage-type=in-memory` 时用 `InMemoryVectorStore`，`persistent` 反射加载 `PersistentVectorStore`，失败回退内存） | — | `zkb.vector.storage-type` / `data-dir` / `dimension` / `index-type` / `metric` |
| `KnowledgeGraphStore` | `JsonFileKnowledgeGraphStore`（默认 `~/.zkb/graph`） | `ZGraphKnowledgeGraphStore`（包装 z-graph `GraphStore`，默认不装配，需自行注册 Bean 覆盖） | `zkb.graph.path` |

注意：`z-kb-storage` 的 POM 虽声明了 MyBatis-Plus / mysql-connector-j / H2，但仓内**没有** JDBC 版
`DocumentRepository` 实现；生产接 MySQL 需按该类注释自行注册覆盖 Bean。

---

## 🏗️ 项目结构

```
z-kb/
├── pom.xml                      # 聚合 POM：继承 z-boot-parent:1.0.21，自家 11 坐标 DM 钉 ${project.version}
├── z-kb-api/                    # SPI 接口 + 领域模型（ChatService / SearchService / KnowledgeBaseService /
│                                #   EmbeddingProvider / ChunkVectorStore / KnowledgeGraphStore / DocumentRepository 等 30 个类）
├── z-kb-core/                   # 解析 / 分块 / 嵌入（TF-IDF、HTTP）/ BM25 + 混合检索 / 实体关系抽取
├── z-kb-vector/                 # z-vector 适配：ZVectorChunkVectorStore + ChunkVectorStoreAutoConfiguration
├── z-kb-graph/                  # 图谱存储：JsonFileKnowledgeGraphStore（默认）+ ZGraphKnowledgeGraphStore
├── z-kb-storage/                # 文档仓库：JsonFile（默认）/ InMemory + 自动装配
├── z-kb-protocol/               # 预留模块：只有 pom，无任何源文件（发布的 jar 里没有 class）
├── z-kb-ingest/                 # 9 种数据源 + IngestPipeline + HtmlToMarkdown
├── z-kb-modeling/               # 工作台 → 产品模型 → 小抄
├── z-kb-spring-boot-starter/    # KBAutoConfiguration + KBProperties（前缀 zkb.*）+ Default{Chat,Search,KnowledgeBase}Service
├── z-kb-web/                    # REST 层：7 个 Controller + SwaggerConfig（Knife4j/springfox），纯 jar，不内置前端静态资源
├── z-kb-bootstrap/              # 独立启动器（ZKbBootstrapApplication，端口 8889）。已从 <modules> 注释排除：
│                                #   standalone uber-jar 约 77MB 触发 Maven Central 上传 broken pipe；其 pom 仍停在 1.0.1
├── z-kb-frontend/               # 独立 npm 工程（React 18 + antd 5 + TS + Vite，pnpm workspace，非 Maven 模块）
├── _doc/                        # 文档目录（见文末）
└── LICENSE                      # MIT
```

reactor 实际参与构建的是 10 个模块（`z-kb-bootstrap` 被注释排除）。各库模块自带
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
注册自己的自动装配；starter 只注册 `KBAutoConfiguration` 一个入口。

---

## 🔧 技术栈（POM 实测）

| 层级 | 技术 |
|------|------|
| 语言 / 运行时 | Java 8（地板 `java.version=1.8`；1.0.3 起产物降到 class-file 52） |
| 框架 | Spring Boot 2.7.18（经 `z-boot-dependencies:1.0.20` 地板；z-kb-vector/graph/storage/starter/web/bootstrap 的 POM 仍字面写 `2.7.12`） |
| 兄弟仓依赖 | `z-vector-api/core`、`z-graph-api/core`、`z-util-core/ch/http` —— 均无字面版本，由 `z-boot-fleet:1.0.1` 下发（repo1 实测面值：z-vector 1.0.5 / z-graph 1.0.8 / z-util 1.0.14）。本仓 POM 中**没有** z-llm 依赖 |
| 本仓刻意覆盖 | Jackson 2.15.4（地板 2.18.6）、Knife4j 4.5.0 openapi2 + springfox 2.10.5（地板 3.0.3 口径）、log4j-api 2.22.1、mysql-connector-j 8.0.33、mybatis-spring 2.1.2 |
| 其它父链不供 | H2 2.2.224、jsoup 1.18.1、slf4j 2.0.13、junit-jupiter 5.10.2（test）；`hanlp.version=1.8.6` 属性已定义但仓内零引用（`HanLpTokenizer` 是仓内正则/词典自实现，不依赖 HanLP 库） |
| 前端 | React 18.3 + antd 5.21 + react-router 6 + echarts + Vite（TypeScript） |
| 构建 | Maven + flatten-maven-plugin 1.5.0（`oss` 常开）；`central` profile 走 central-publishing-maven-plugin 0.7.0 + GPG + sources/javadoc |

---

## 🚀 快速开始

### 编译

```bash
mvn clean install -DskipTests
```

版本口径由 `z-boot-parent:1.0.21` → 地板 + fleet 供给，构建机需能解析
`io.github.yuku123:z-boot-parent:1.0.21`（repo1 或本地仓）。

### 嵌入宿主应用（Spring Boot Starter）

```xml
<dependency>
    <groupId>io.github.yuku123</groupId>
    <artifactId>z-kb-spring-boot-starter</artifactId>
    <version>1.0.5</version>
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
| `zkb.vector.storage-type` / `data-dir` / `index-type` / `metric` | in-memory（默认）/ persistent；HNSW + COSINE 口径 |
| `zkb.storage.path` / `zkb.graph.path` | JSON 文件持久化位置（默认 `~/.zkb/`） |

**API Key 等凭据必须经环境变量注入**（Spring relaxed binding，如 `ZKB_CHAT_API_KEY`、
`ZKB_EMBEDDING_API_KEY`），禁止写进 yml / jar / 镜像层。

### 独立启动

唯一入口是 `z-kb-bootstrap` 的 `ZKbBootstrapApplication`（component-scan `com.zifang.z.kb`）。
该模块当前不在 reactor（见项目结构说明），POM 停在 1.0.1；默认监听 **8889**，
Knife4j 文档在 `http://localhost:8889/doc.html`，Actuator 暴露 `health,info,metrics`。

### 管理前端

```bash
cd z-kb-frontend
pnpm install
pnpm dev        # Vite 监听 5173
```

注意：`vite.config.ts` 的 `/api` 代理目标是 `http://localhost:8080`，与后端默认端口 **8889 不一致**，
本地联调需覆盖后端 `server.port=8080` 或改代理目标。页面：Dashboard / Documents / DataSources /
SearchPage / ChatPage / GraphPage / ModelingPage。

---

## 🔌 API 一览（z-kb-web，7 个 Controller 实测）

| 路径 | Controller | 说明 |
|------|------------|------|
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

如实说明：**全仓没有任何 `src/test` 目录**（`find . -path '*/src/test/*'` 为空），上面的命令实际不执行任何用例；
旧 README 的"421 单元 / 87 集成测试 PASS"无对应代码，已删除。功能验证目前依赖启动后走
Knife4j（`/doc.html`）与 `z-kb-frontend` 页面。

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

本项目文档统一收口在 `_doc/` 下（实测 `find _doc -mindepth 1` 仅 1 个文件）:

- `_doc/001_arch/` — 目前为空目录（暂无架构文档）
- `_doc/002_deploy/` — 目前为空目录（暂无部署文档）
- [`_doc/003_script/`](_doc/003_script/) — 运维脚本:
  - [`deploy_maven_center.sh`](_doc/003_script/deploy_maven_center.sh) — Maven Central 一键发布 / 校验 / GPG 初始化
- `_doc/004_skill/` — 目前为空目录（暂无 skill）

_Maintained by the z-opc-foundation organization._
