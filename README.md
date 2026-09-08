# z-kb

> **自研产品级知识库系统** — 对标 LightRAG + BookStack/Mindoc + RAGFlow + Anything-LLM 的融合形态

## 一句话定位

z-kb 是一个 **Java 17 + Spring Boot 2.7 + z-vector(向量库) + z-graph(图数据库) + z-util(工具集)** 的产品级知识库系统，提供 Markdown 文档管理、混合检索（向量 + 全文 + 图谱）、GraphRAG 问答、工作台会话、版本快照、双向链接、知识图谱可视化等能力，目标对标可直接售卖的成熟知识库产品。

## 设计融合

| 参考项目 | 复用能力 | NAS 路径 |
|---|---|---|
| **LightRAG** | GraphRAG 范式：实体关系抽取 + 图谱融合检索 | `/Volumes/personal_folder/学习/source-from-github/176_LightRAG/` |
| **RAGFlow** | 深度文档理解 + 智能分块 + 多路召回 + Rerank | `/Volumes/personal_folder/学习/source-from-github/226_anything-llm/` |
| **Anything-LLM** | 工作台/会话管理 + 引用追踪 + 多知识库隔离 | `/Volumes/personal_folder/学习/source-from-github/226_anything-llm/` |
| **BookStack / Mindoc** | 文档树 + Markdown 导入导出 + 版本快照 | 通用实践 |
| **Obsidian / Logseq** | 双向链接 `[[wikilink]]` + 标签系统 + 知识图谱 | 通用实践 |
| **SiYuan** | 块级（Block）管理 + 数据库视图 | 通用实践 |

## 模块架构

```
z-kb-parent (parent, packaging=pom)
├── z-kb-api              公共接口与数据模型（Document/Chunk/Entity/Relation/Query/Service）
├── z-kb-core              核心引擎（Markdown 解析、智能分块、实体抽取、Embedding、混合检索）
│   ├── parser/             frontmatter / wikilink / 标题 / 代码块 / 表格
│   ├── chunker/            标题感知 + Token 感知分块
│   ├── extractor/          基于规则 + 共现窗口的实体关系抽取
│   ├── embedding/          Embedding 接口 + TF-IDF 本地实现 + HTTP 远程实现
│   └── search/             向量 + BM25 + 图谱三路召回 + RRF 融合
├── z-kb-vector            向量检索适配（封装 z-vector，提供 ChunkVectorStore）
├── z-kb-graph             图谱适配（封装 z-graph，提供 KnowledgeGraphStore）
├── z-kb-storage           元数据存储（MySQL/H2 + MyBatis-Plus）
├── z-kb-protocol          OpenAPI 3.0 规范 + DTO
├── z-kb-spring-boot-starter  Spring Boot 自动装配
├── z-kb-web               REST API + Knife4j 文档
└── z-kb-bootstrap         启动器（默认 :8889，可独立部署）

z-kb-frontend             前端：React 19 + Vite 6 + Ant Design 6
```

## 核心能力

| 能力 | 实现状态 | 说明 |
|---|---|---|
| **Markdown 导入** | ✅ | 支持 frontmatter (yuque/obsidian 兼容)、双向链接 `[[wikilink]]`、标签系统 |
| **智能分块** | ✅ | 标题感知（H1/H2/H3 切分）+ Token 预算（默认 256 token/chunk, 80 token 重叠） |
| **Embedding** | ✅ | TF-IDF 本地实现（512 维）+ HTTP 远程实现（OpenAI/Qwen/GLM） |
| **向量检索** | ✅ | 基于 z-vector HNSW 索引，COSINE 距离 |
| **全文检索** | ✅ | 基于 HanLP 中文分词 + BM25 |
| **实体关系抽取** | ✅ | 基于规则（词典）+ 共现窗口（句子级） |
| **图谱检索** | ✅ | 基于 z-graph，多跳遍历 |
| **混合检索** | ✅ | RRF (Reciprocal Rank Fusion) 三路召回 |
| **GraphRAG** | ✅ | 实体-关系-块三元组，联合检索 |
| **版本快照** | ✅ | 基于 z-graph 的 GraphVersionStore |
| **REST API** | ✅ | Knife4j 文档 `/doc.html` |
| **工作台 / 会话** | ✅ | 多会话 + 引用源追踪 |
| **前端 UI** | ✅ | React 19 + Ant Design 6 |
| **图谱可视化** | ✅ | 前端 ECharts/AntV G6 |
| **LLM 集成** | 🚧 | Embedding/LLM 接口已抽象，支持 OpenAI/Qwen/GLM |

## 快速开始

### Maven 构建

```bash
# 1. 确保依赖已安装
mvn install -pl z-vector -am -DskipTests  # 安装 z-vector
mvn install -pl z-graph -am -DskipTests   # 安装 z-graph

# 2. 编译 z-kb
mvn clean install -DskipTests

# 3. 启动后端（默认 :8889）
cd z-kb-bootstrap
mvn spring-boot:run
# 或打包后运行
java -jar target/z-kb-bootstrap-1.0.0-SNAPSHOT.jar

# 4. 启动前端
cd z-kb-frontend
npm install
npm run dev   # 默认 :5173
```

### 浏览器访问

| 地址 | 说明 |
|------|------|
| http://localhost:8889/doc.html | Knife4j API 文档 |
| http://localhost:8889/actuator/health | 健康检查 |
| http://localhost:5173 | 前端 UI |

## API 样例

### 导入文档

```bash
curl -X POST http://localhost:8889/api/kb/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "InfluxDB 实战指南",
    "content": "# InfluxDB 实战指南\n\nInfluxDB 是 ...",
    "tags": ["时序数据库", "InfluxDB"],
    "workspace": "default"
  }'
```

### 混合检索

```bash
curl -X POST http://localhost:8889/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "InfluxDB 写入性能优化",
    "topK": 10,
    "workspace": "default",
    "mode": "hybrid",
    "vectorWeight": 0.5,
    "keywordWeight": 0.3,
    "graphWeight": 0.2
  }'
```

### 图谱检索

```bash
curl http://localhost:8889/api/kb/graph/entity/InfluxDB?workspace=default&depth=2
```

### RAG 问答

```bash
curl -X POST http://localhost:8889/api/kb/chat \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "default",
    "sessionId": "sess-001",
    "question": "InfluxDB 适合什么场景？",
    "topK": 5
  }'
```

## 版本历史

- **v1.0.0-SNAPSHOT** (2026-09-08)
  - 全新设计：独立 Maven 工程，9 个 Maven 模块 + 1 个前端工程
  - 文档管理：导入/分块/版本/标签
  - 混合检索：向量 + BM25 + 图谱 RRF
  - GraphRAG：实体关系抽取 + 图谱遍历
  - 前端：React 19 + Vite 6 + Ant Design 6
  - 测试数据：13,086 篇 yuque 文档（366MB）

## 维护

- 模块维护人：z-kb 团队
- 反馈渠道：GitLab Issues
- 文档：本 README + 代码注释（JavaDoc）
