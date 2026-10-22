# 项目总览

## 1. 项目简介

z-kb 是 z-opc-foundation 的**知识库服务**：文档从 9 种数据源接入后，经 Markdown 解析 → 分块 → 向量化 →
实体/关系抽取，落到向量库与图谱存储；检索侧由 `HybridSearcher` 做向量 / BM25 / 图谱三路召回 + RRF 融合；
上层由 `DefaultChatService` 提供带引用的会话式 RAG 问答（未配 LLM 端点时回退抽取式回答）。

**两种交付形态：** `z-kb-spring-boot-starter` 嵌入宿主应用（只引入这一个坐标即完成装配），
或 `z-kb-bootstrap` 独立启动（监听 `8889`）；管理前端是独立的 npm 工程 `z-kb-frontend`（React + antd）。

**Maven 坐标：** `io.github.yuku123:z-kb:1.0.7`（根 POM `packaging=pom`），父项目
`io.github.yuku123:z-boot-parent:1.1.0`（`<relativePath/>` 留空，父件在 Maven 中央仓不在磁盘上）。

**技术栈：** Java 8 + Spring Boot 2.7.18 + Maven 多模块（10 个 reactor 模块）；
存储侧复用兄弟仓 z-vector / z-graph；前端 React 18 + antd 5 + Vite（TypeScript）。

## 2. 模块架构

```
z-kb/
├── pom.xml                     # 聚合 POM：父 z-boot-parent:1.1.0，自家 11 坐标 DM 钉 ${project.version}
├── z-kb-api/                   # SPI 接口 + 领域模型：30 个类，包 com.zifang.z.kb.api
│                               #   （SearchService / ChatService / KnowledgeBaseService / EmbeddingProvider
│                               #    / ChunkVectorStore / KnowledgeGraphStore / DocumentRepository / SearchMode …）
├── z-kb-core/                  # 解析 / 分块 / 嵌入 / 检索 / 实体关系抽取 / 评测，6 个子包
│                               #   parser（MarkdownParser / FrontmatterParser / WikilinkExtractor）
│                               #   embedding（TfIdfEmbeddingProvider / HttpEmbeddingProvider）
│                               #   search（Bm25Searcher / HybridSearcher）
│                               #   extractor（EntityExtractor / RelationExtractor）
│                               #   eval（检索评测 / 生成评测 / 消融对照，9 个类）
│                               #   util（HanLpTokenizer 等）
├── z-kb-vector/                # z-vector 适配：ZVectorChunkVectorStore + 自动装配 + 属性
├── z-kb-graph/                 # 图谱存储：JsonFileKnowledgeGraphStore（默认）+ ZGraphKnowledgeGraphStore
├── z-kb-storage/               # 文档仓库：JsonFile（默认）/ InMemory + 自动装配
├── z-kb-protocol/              # 协议层：REST 请求/响应 DTO + OpenAPI 契约注解（request / response 两个子包）
├── z-kb-ingest/                # 9 种 DataSource + IngestPipeline + HtmlToMarkdown
├── z-kb-modeling/              # 工作台 → 产品模型 → 小抄
├── z-kb-spring-boot-starter/   # KBAutoConfiguration + KBProperties（前缀 zkb.*）+ 三个 Default*Service
├── z-kb-web/                   # REST 层：7 个 Controller + SwaggerConfig（Knife4j / springfox），纯 jar
├── z-kb-bootstrap/             # 独立启动器 ZKbBootstrapApplication（端口 8889）。
│                               #   已从根 POM <modules> 注释排除（standalone uber-jar 体积触发中央上传失败）
├── z-kb-frontend/              # 独立 npm 工程（React 18 + antd 5 + TS + Vite，非 Maven 模块）
├── _eval/                      # 语料生成脚本（gen_corpus.py / gen_corpus_longtail.py）
└── _doc/                       # 文档目录：001_arch / 003_script / 006_release
```

**reactor 实际参与构建的是 10 个模块**（`z-kb-bootstrap` 被注释排除）。`z-kb-ingest` / `z-kb-modeling` /
`z-kb-graph` / `z-kb-storage` / `z-kb-vector` / `z-kb-spring-boot-starter` 六个模块各自带
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，
starter 只注册 `KBAutoConfiguration` 一个入口。

## 3. 核心功能

### 3.1 多源接入（`z-kb-ingest`，18 个类）

`z-kb-ingest/source/` 下 9 支 `DataSource` 实现：`YuqueSource`、`NotionSource`、`ConfluenceSource`、
`FeishuSource`、`DingtalkSource`、`GitSource`、`LocalDirSource`、`UrlSource`、`WebhookSource`。
`IngestPipeline` 负责拉取 → `HtmlToMarkdown` → 落库，同步执行与异步提交两种模式（`submit` / `flush`）。

### 3.2 解析 / 分块 / 向量化（`z-kb-core`）

- `MarkdownParser` 解析正文，`FrontmatterParser` 抽 frontmatter，`WikilinkExtractor` 抽双向链接。
- `Chunker` 按 token 口径分块：`max-tokens` / `overlap-tokens` / `min-tokens`。
- 嵌入两支实现：`TfIdfEmbeddingProvider`（离线默认）与 `HttpEmbeddingProvider`（OpenAI 兼容端点）。

### 3.3 混合检索（`z-kb-core/search`）

`Bm25Searcher` 做关键词打分，`HybridSearcher` 融合向量 / BM25 / 图谱三路召回。
`SearchMode` 枚举 5 种模式：`VECTOR` / `KEYWORD` / `GRAPH` / `HYBRID` / `FUSION`。

### 3.4 存储后端（三个可插拔接口 + 各自自动装配）

| 接口 | 默认实现 | 备选 | 所在模块 |
|---|---|---|---|
| `DocumentRepository` | `JsonFileDocumentRepository` | `InMemoryDocumentRepository` | z-kb-storage |
| `ChunkVectorStore` | `ZVectorChunkVectorStore`（包装 z-vector） | `InMemoryVectorStore`（z-vector 仓的 `com.zifang.z.vector.core`） | z-kb-vector |
| `KnowledgeGraphStore` | `JsonFileKnowledgeGraphStore` | `ZGraphKnowledgeGraphStore` | z-kb-graph |

`JsonFileKnowledgeGraphStore` 一工作台一份 JSON，文件名是 workspace 名的**可逆转义**
（合法字符原样保留，其余编成 `~` + 两位大写 hex），因此中文、含 `.` / `:` / 空格的工作台名互不覆盖。

向量后端按 `zkb.vector.storage-type` 分支：`in-memory`（默认）直接用 z-vector 的 `InMemoryVectorStore`；
`persistent` 走**反射**加载 `com.zifang.z.vector.storage.PersistentVectorStore`，类不在时打 warn 并回退内存，
不因可选依赖缺失而启动失败。

### 3.5 RAG 问答与知识建模

- `DefaultChatService`（starter）：单次问答 + 会话管理（createSession / chatInSession / getHistory）；
  `zkb.chat.endpoint` 留空或 LLM 调用失败时回退抽取式回答。
- `z-kb-modeling`：`ModelingService.decompose` → `ProductModel` → `CheatSheet`，
  由 `ProductDecomposer` / `CausalChainExtractor` / `CheatSheetGenerator` 三段实现。

### 3.6 REST 面（`z-kb-web`，7 个 Controller）

`ChatController` / `DocumentController` / `SearchController` / `GraphController` /
`WorkspaceController` / `IngestController` / `ModelingController`，统一挂在 `/api/kb/*` 下；
 Knife4j 文档走 `/doc.html`。

### 3.7 检索质量评测（`z-kb-core/eval`，9 个类）

- `RetrievalEvaluator` / `RetrievalMetrics`：用一份带版本号的黄金集跑单个检索模式，产出 `RetrievalEvalReport`。
- `GenerationEvaluator` / `GenerationEvalReport`：跑「有检索 / 无检索」两个臂做生成侧对照。
- `AblationRunner`：检索策略消融对照（证明检索增强到底增强了多少）。
- `LlmJudge`：走任意 OpenAI 兼容端点做 LLM-as-judge。

### 3.8 管理前端（`z-kb-frontend`）

7 个页面：`Dashboard` / `Documents` / `DataSources` / `SearchPage` / `ChatPage` / `GraphPage` /
`ModelingPage`，Vite dev 监听 `5173`。

## 4. 对外集成 / 上下游

**上游依赖（兄弟仓，Maven 坐标由父链 `z-boot-fleet` 下发）：** `z-vector-api` / `z-vector-core`（向量库）、
`z-graph-api` / `z-graph-core`（图谱库）、`z-util-core` / `z-util-parser-json` 等（工具集）。
本仓 POM 中**没有** z-llm 依赖。

**对外 HTTP 边界（`z-kb-web` + `z-kb-bootstrap`）：** 独立启动时监听 **`8889`**
（`z-kb-bootstrap/src/main/resources/application.yml`），context-path 为 `/`，
对外路径全部在 `/api/kb/*` 下；Knife4j 文档在 `/doc.html`，Actuator 暴露 `health,info,metrics`。
作为 starter 嵌入宿主时，端口与 context-path 随宿主应用。

**下游消费方：** 引用 `z-kb-spring-boot-starter` 的宿主应用（配置前缀 `zkb.*`）；
或直接引用 `z-kb-core` / `z-kb-api` 自建流水线的应用。

**运维脚本：** `_doc/003_script/deploy_maven_center.sh`（子命令 `publish` / `verify` / `gpg-init` / `readme`），
凭据从仓内 `.env` 读取（已在 `.gitignore` 内）。

## 5. 技术特点

1. **强制桶之外无空目录**：`_doc/` 下只有 `001_arch` / `003_script` / `006_release` 三个真实桶，
   README「文档目录」段与磁盘双向对齐，不列空桶。
2. **存储全部走可插拔接口 + 自动装配**：文档仓库 / 向量库 / 图谱三处各是一个接口 + 一个 JSON 文件默认实现 +
   一个 `AutoConfiguration.imports`，换后端只改配置（`zkb.storage.path` / `zkb.vector.storage-type` / `zkb.graph.path`），
   不改业务代码。
3. **图谱文件名用可逆转义而非下划线压缩**：非法字符编成 `~` + 两位大写 hex，编码是单射，
   旧实现把非法字符一律压成同一个下划线会让「默认空间」与「生产环境」算出同一个文件名、互相覆盖。
4. **离线可跑是硬要求**：默认嵌入实现是 `TfIdfEmbeddingProvider`（不调外部端点），
   `zkb.chat.endpoint` 留空时问答走抽取式回答 —— 不配任何 API Key 也能起库、能检索、能问答。
5. **检索质量有硬证据而非口头声明**：`z-kb-core/eval` 里 9 个类把「检索侧指标」「生成侧两臂对照」
   「策略消融」三件事做成可归档报告，`_eval/` 下两个脚本生成评测语料。
6. **bootstrap 从 reactor 排除是工程决策不是遗漏**：standalone uber-jar 体积触发 Maven Central 上传失败，
   故根 POM 里 `z-kb-bootstrap` 被注释排除、其余 10 支库模块照常发布。
7. **前端代理目标与后端默认端口不一致**：`z-kb-frontend/vite.config.ts` 的 `/api` 代理指向
   `http://localhost:8080`，而后端独立启动端口是 `8889` —— 本地联调需覆盖 `server.port` 或改代理目标。

## 6. 目录结构

本仓无单一 Java 包树，按 Maven 模块切分；公共包根为 `com.zifang.z.kb`：

```
com.zifang.z.kb
├── api/                 # 30 个类全在一个包：SPI 接口 + 领域模型 + SearchMode / DocumentStatus 枚举
├── core/                # z-kb-core
│   ├── parser/          # MarkdownParser / FrontmatterParser / WikilinkExtractor
│   ├── embedding/       # TfIdfEmbeddingProvider / HttpEmbeddingProvider
│   ├── search/          # Bm25Searcher / HybridSearcher
│   ├── extractor/       # EntityExtractor / RelationExtractor
│   ├── eval/            # 检索评测 / 生成评测 / 消融 / LLM 裁判
│   └── util/            # HanLpTokenizer 等分词工具
├── vector/              # z-kb-vector：impl/ + autoconfigure/
├── graph/               # z-kb-graph：impl/ + autoconfigure/
├── storage/             # z-kb-storage：impl/
├── protocol/            # z-kb-protocol：request/ + response/
├── ingest/              # z-kb-ingest：api/ + source/ + pipeline/ + util/
├── modeling/            # z-kb-modeling：core/ + model/ + extractor/ + generator/
├── starter/             # z-kb-spring-boot-starter：config/ + service/ + metrics/
├── web/                 # z-kb-web：controller/ + config/ + exception/
└── bootstrap/           # z-kb-bootstrap：ZKbBootstrapApplication（单类）
```

**规模（`src/main/java` 实测）：** api 30 文件 / 1618 行，core 20 文件 / 2804 行，
ingest 18 文件 / 1883 行，protocol 14 文件 / 464 行，web 9 文件 / 553 行，
modeling 7 文件 / 927 行，starter 6 文件 / 1270 行，storage 4 文件 / 699 行，
vector 3 文件 / 252 行，graph 3 文件 / 838 行，bootstrap 1 文件 / 21 行。

**测试：** `src/test` 共 15 个 Java 文件，分布在 core / graph / protocol / starter / storage / vector / web
七个模块（仓内最重的两块是 `z-kb-core` 的检索评测与 `z-kb-web` 的 REST 契约测试）。
