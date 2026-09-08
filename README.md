# z-kb

> **自研产品级知识库系统** — 对标 LightRAG + BookStack/Mindoc + RAGFlow + Anything-LLM 的融合形态

## 一句话定位

z-kb 是一个 **Java 17 + Spring Boot 2.7.18 + z-vector(向量库) + z-graph(图数据库) + z-util(工具集)** 的产品级知识库系统。具备：

- 📚 **多渠道文档接入**（语雀/Notion/Confluence/飞书/钉钉/Git/本地目录/URL/Webhook）
- 🔍 **混合检索**（BM25 + 向量 + 图谱融合，RRF 重排序）
- 🧠 **GraphRAG 问答**（实体/关系抽取 + 因果链推理）
- 🤖 **产品逻辑建模**（拆解 + Cheat Sheet 小抄自动生成）
- 💾 **持久化 & 弹性恢复**（JSON 文件 + 启动时索引重建）
- 🌐 **可视化图谱 & 7 页面控制台**（React + Vite + AntD）

## 设计融合

| 参考项目 | 复用能力 |
|---|---|
| **LightRAG / GraphRAG** | 实体/关系抽取、图谱融合检索 |
| **RAGFlow** | 深度文档理解、智能分块、多路召回 |
| **Anything-LLM** | 工作台/会话管理、引用追踪、多知识库隔离 |
| **BookStack / Mindoc** | 文档树、Markdown 导入导出、版本快照 |
| **Obsidian / Logseq** | 双向链接 `[[wikilink]]`、标签系统、知识图谱 |
| **SiYuan** | 块级（Block）管理、数据库视图 |

## 模块架构

```
z-kb-parent (parent, packaging=pom)
├── z-kb-api               公共接口与数据模型（Document/Chunk/Entity/Relation/Service）
├── z-kb-core               核心引擎（Markdown 解析、智能分块、实体抽取、Embedding、混合检索）
│   ├── parser/             frontmatter + wikilink + 标题/代码块/表格
│   ├── chunker/            标题感知 + Token 预算
│   ├── extractor/          规则 + 共现窗口的实体/关系抽取
│   ├── embedding/          Embedding 接口 + TF-IDF 本地实现 + HTTP 远程实现
│   └── search/             向量 + BM25 + 图谱三路召回 + RRF 融合
├── z-kb-vector             向量检索适配（封装 z-vector）
├── z-kb-graph              图谱适配（封装 z-graph，JSON 文件持久化）
├── z-kb-storage            文档/Chunk/Workspace 存储（JSON 文件 + MyBatis-Plus 兼容）
├── z-kb-protocol           OpenAPI 3.0 规范 + DTO
├── z-kb-spring-boot-starter  Spring Boot 自动装配
├── z-kb-ingest             多渠道数据接入管道（9 种数据源）
├── z-kb-modeling           产品逻辑建模（拆解 + 因果链 + 小抄生成）
├── z-kb-web                REST API + Knife4j 文档
└── z-kb-bootstrap          启动器（默认 :8080，可独立部署）

z-kb-frontend               前端：React 18 + Vite 5 + Ant Design 5 + TypeScript
```

## 核心能力

| 能力 | 状态 | 说明 |
|---|---|---|
| **Markdown 导入** | ✅ | frontmatter (yuque/obsidian 兼容) + wikilink `[[]]` + 标签 |
| **智能分块** | ✅ | 标题感知（H1/H2/H3）+ Token 预算（默认 512 token/chunk） |
| **Embedding** | ✅ | TF-IDF 本地（512 维）+ HTTP 远程（OpenAI/Qwen/GLM 接口已抽象） |
| **向量检索** | ✅ | 基于 z-vector HNSW 索引 |
| **全文检索** | ✅ | BM25（TF-IDF 衍生） |
| **实体关系抽取** | ✅ | 规则 + 共现窗口，5 类实体（CONCEPT/TECHNOLOGY/TOOL/DATABASE/PERSON） |
| **图谱检索** | ✅ | 基于 z-graph，多跳遍历、子图查询 |
| **混合检索** | ✅ | RRF 三路召回，可调权重 |
| **GraphRAG 问答** | ✅ | 实体-关系-块三元组联合检索 + 抽取式回答 |
| **多渠道接入** | ✅ | 9 种数据源：语雀、Notion、Confluence、飞书、钉钉、Git、本地目录、URL、Webhook |
| **产品建模** | ✅ | 拆解 + 因果链抽取 + Markdown 小抄自动生成（带 mermaid 流程图） |
| **持久化** | ✅ | JSON 文件，重启不丢数据 + 自动重建索引（向量+BM25） |
| **REST API** | ✅ | Knife4j 文档 `/swagger-ui.html` + 业务 API |
| **工作台 / 会话** | ✅ | 多工作台隔离 + RAG 会话管理 |
| **前端 UI** | ✅ | 7 个页面（仪表板/文档/接入/建模/检索/图谱/问答） |
| **图谱可视化** | ✅ | D3 力导向图，节点按类型彩色区分 |

## 快速开始

### 1. 准备依赖

```bash
# 安装 z-vector 和 z-graph 到本地仓库
cd /Users/zifang/workplace/ceo_workplace/z-opc-foundation/z-vector
mvn install -DskipTests
cd /Users/zifang/workplace/ceo_workplace/z-opc-foundation/z-graph
mvn install -DskipTests
```

### 2. 构建 z-kb

```bash
cd /Users/zifang/workplace/ceo_workplace/z-opc-foundation/z-kb
mvn clean install -DskipTests
```

### 3. 启动后端（默认 :8080）

```bash
cd z-kb-bootstrap
java -jar target/z-kb-bootstrap-1.0.0-SNAPSHOT.jar
# 或：nohup java -Xmx2g -jar target/z-kb-bootstrap-1.0.0-SNAPSHOT.jar > /tmp/zkb.log 2>&1 &
```

### 4. 启动前端（默认 :5173）

```bash
cd z-kb-frontend
npm install
npm run dev
```

### 5. 浏览器访问

| 地址 | 说明 |
|---|---|
| http://localhost:5173 | 前端 UI（7 个页面） |
| http://localhost:8080/swagger-ui.html | Swagger API 文档 |
| http://localhost:8080/actuator/health | 健康检查 |

## API 样例

### 多渠道文档接入（语雀/Notion/本地目录等）

```bash
# 本地目录批量接入
curl -X POST 'http://localhost:8080/api/kb/ingest/run?sourceId=local-default' \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/path/to/markdown/files",
    "recursive": true,
    "limit": 500,
    "workspace": "default"
  }'

# 列出所有已注册数据源
curl http://localhost:8080/api/kb/ingest/sources
```

### 混合检索

```bash
curl -X POST http://localhost:8080/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "TCP 三次握手",
    "topK": 10,
    "workspace": "default",
    "mode": "FUSION",
    "vectorWeight": 0.5,
    "keywordWeight": 0.3,
    "graphWeight": 0.2
  }'
```

### GraphRAG 问答

```bash
curl -X POST http://localhost:8080/api/kb/chat \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "default",
    "question": "操作系统进程调度算法有哪些",
    "topK": 5
  }'
```

### 产品建模（小抄生成）

```bash
# 一站式：拆解 + 渲染小抄
curl 'http://localhost:8080/api/kb/modeling/cheatsheet?workspace=default'
```

### 工作台统计

```bash
curl 'http://localhost:8080/api/kb/workspaces/default/statistics'
```

## 压测表现（实测）

| 数据规模 | 文档数 | 块数 | 实体数 | 关系数 | 存储 | 导入耗时 |
|---|---|---|---|---|---|---|
| 小型 | 4 | 367 | 902 | 11,198 | 12MB | < 1s |
| 中型 | 314 | 11,624 | 8,746 | 60,479 | 126MB | 11s |
| 全量 | 13,086 | 待测 | - | - | - | - |

> 314 篇文档压测全部成功，重启后 7.5 秒自动重建索引，搜索响应 < 15ms。

## 持久化设计

数据落在 `~/.zkb/`：

```
~/.zkb/
├── zkb.json                # 文档 + Chunk + Workspace（JSON 持久化）
└── graph/
    └── <workspace>.json    # 实体 + 关系（按 workspace 分文件）
```

启动时自动从持久化文件重建：
- 文档/Chunk/工作台 → 内存索引
- 向量集合 + BM25 → 重新训练 TF-IDF + 重建 HNSW
- 图谱 → 内存遍历器

## 版本历史

- **v1.0.0** (2026-09-08)
  - **后端**：12 个 Maven 模块，87 个 Java 源文件
  - **前端**：React + Vite + AntD + TypeScript，7 个页面
  - **多渠道**：9 种数据源适配器
  - **建模**：拆解 + 因果链 + 小抄生成
  - **持久化**：JSON 文件存储，启动时自动重建索引
  - **测试数据**：314 篇 yuque-loc 文档 / 11,624 chunks

## 维护

- 模块维护人：z-kb 团队
- 代码仓库：`github.com:z-opc-foundation/z-kb.git`
- 反馈渠道：GitHub Issues
- 文档：本 README + 代码注释（JavaDoc）
