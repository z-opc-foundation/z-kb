# z-kb

> **企业级 RAG 知识库平台** — 文档解析 → 分块 → Embedding → 向量检索 → LLM 问答
> 融合 z-vector 向量库 + z-graph 图数据库 + 多 LLM Provider (OpenAI/Qwen/GLM) + 离线 TF-IDF
> 一行 Spring Boot Starter 接入, 支持私有化部署

[![Maven Central](https://img.shields.io/badge/Maven%20Central-1.0.1-blue?logo=apache-maven)](https://central.sonatype.com/search?q=g:io.github.yuku123+a:z-kb*)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Java](https://img.shields.io/badge/Java-8%2B-orange)](https://openjdk.org)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.x-6DB33F)](https://spring.io)

---

## 🚀 5 分钟接入

### 方式一：本地 RAG 问答（最简模式）

不需要任何外部服务，本地跑通端到端 RAG：

```xml
<dependency>
    <groupId>io.github.yuku123</groupId>
    <artifactId>z-kb-spring-boot-starter</artifactId>
    <version>1.0.1</version>
</dependency>
```

`application.yml`:

```yaml
z:
  kb:
    enabled: true
    workspace: default
    storage:
      type: jdbc
      jdbc-url: jdbc:h2:mem:kb;DB_CLOSE_DELAY=-1
      username: sa
      password: ""
    embedding:
      provider: tfidf          # 离线 TF-IDF, 不需要 LLM API Key
      dimension: 512
    llm:
      provider: extractive     # 没配 LLM 时默认抽取式回答
      max-tokens: 2000
```

```java
@SpringBootApplication
public class KbApp { public static void main(String[] args) { SpringApplication.run(KbApp.class, args); } }

@RestController
public class KbController {

    @Autowired private KnowledgeBaseService kbService;     // 文档导入
    @Autowired private SearchService searchService;        // 检索
    @Autowired private ChatService chatService;            // 问答

    // 1. 导入文档
    @PostMapping("/import")
    public ImportResult importText(@RequestParam String title, @RequestBody String text) {
        return kbService.importText(title, text, "default");
    }

    // 2. 纯检索
    @GetMapping("/search")
    public List<SearchHit> search(@RequestParam String q) {
        return searchService.search(q, "default", 5);
    }

    // 3. RAG 问答
    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest req) {
        return chatService.chat(req);
    }
}
```

### 方式二：接 LLM（OpenAI / Qwen / GLM）

```yaml
z:
  kb:
    enabled: true
    embedding:
      provider: openai
      api-key: ${OPENAI_API_KEY}
      model: text-embedding-3-small
      dimension: 1536
    llm:
      provider: openai
      api-key: ${OPENAI_API_KEY}
      model: gpt-4o-mini
      temperature: 0.3
      max-tokens: 2000
```

### 方式三：API 调用（不做 Spring Boot）

```xml
<dependency>
    <groupId>io.github.yuku123</groupId>
    <artifactId>z-kb-api</artifactId>
    <version>1.0.1</version>
</dependency>
```

实现 `ChatService` / `KnowledgeBaseService` 等接口，不依赖 Spring 容器。

---

## 📦 已发布到 Maven Central 的所有模块

> groupId: `io.github.yuku123` · version: **1.0.1**

| 模块 | 说明 | 何时该引入 |
|---|---|---|
| `z-kb-api` | 抽象接口（Chat / Search / KnowledgeBase / EmbeddingProvider） | 二次开发 |
| `z-kb-core` | 默认实现（TfIdf + 抽取式回答 + 文档解析 + 分块） | 离线/测试 |
| `z-kb-vector` | z-vector 集成（向量检索） | 向量检索场景 |
| `z-kb-graph` | z-graph 集成（图谱关联查询） | 实体关系挖掘 |
| `z-kb-storage` | 文档元数据 + chunk 存储（JDBC + JSON） | 自定义持久层 |
| `z-kb-protocol` | 内部通信协议（文档版本 / 切片 trace） | 自定义协议 |
| `z-kb-ingest` | 多格式解析（PDF / Word / Markdown / HTML / CSV） | 自定义解析器 |
| `z-kb-modeling` | 文档建模 + 实体抽取（NER + 关系抽取） | 知识图谱构建 |
| `z-kb-spring-boot-starter` | Spring Boot 自动装配 | Spring Boot 应用 |
| `z-kb-web` | 文档管理 UI（React + AntD） | 完整平台 |

---

## ✨ 核心能力

### 文档解析
- ✅ **多格式**：PDF（pdfbox）/ Word（poi）/ Markdown / HTML（jsoup）/ CSV / TXT
- ✅ **结构化分块**（按段落 / 标题 / 章节 / 滑动窗口）
- ✅ **去重 + 增量更新**（基于 hash）
- ✅ **批量导入**（支持 10w 文档 / 文件夹）

### 向量化
- ✅ **4 个 Embedding Provider**：
  - `tfidf` — 离线 TF-IDF + 字符 n-gram（512 维，免费）
  - `openai` — text-embedding-3-small / large
  - `qwen` — 通义千问 text-embedding-v3
  - `glm` — 智谱 AI embedding-2
- ✅ **批量向量化**（`embedBatch` 减少 API 调用）
- ✅ **维度校验**（建 Collection 时拒绝不匹配）

### 检索
- ✅ **向量检索**（HNSW / IVF，可切换 z-vector 后端）
- ✅ **全文检索**（基于 z-vector FTS，BM25）
- ✅ **混合检索**（RRF 融合 + 加权）
- ✅ **图谱检索**（基于 z-graph 实体关系）
- ✅ **元数据过滤**（按 workspace / 时间 / 来源）
- ✅ **Re-ranking**（cross-encoder / cohere / bge-reranker）

### 问答
- ✅ **RAG 模式**：检索 top-K + 拼装 prompt + LLM 生成
- ✅ **多轮对话**（session 管理 + 历史上下文）
- ✅ **引用溯源**（`SearchHit.references` 返回引用块）
- ✅ **离线抽取式回答**（无 LLM 时也能用）
- ✅ **Streaming 输出**（SSE 流式生成）

### LLM 适配
- ✅ **4 个 Provider**：openai / qwen / glm / ollama（本地）
- ✅ **Function calling**（结构化输出）
- ✅ **Token 计数 + 成本估算**
- ✅ **可观测性**（每次调用的 prompt + completion 落库）

### 部署
- ✅ **单机模式**（H2 / SQLite 内存）
- ✅ **集群模式**（MySQL + z-vector standalone + z-graph）
- ✅ **可视化控制台**（React + AntD，端口 8080）
- ✅ **多租户**（workspace 隔离）

---

## ⚙️ 实用 Case（生产场景）

### Case 1: 导入 PDF 文档 + 自动切片

```java
@PostMapping("/upload")
public ImportResult upload(@RequestParam MultipartFile file) throws IOException {
    String title = file.getOriginalFilename();
    // 自动按段落切片 (默认 512 字符 / 块, 50 重叠)
    return kbService.importFile(title, file.getBytes(), file.getContentType(), "default");
}

// 进度
@GetMapping("/status/{docId}")
public DocumentStatus status(@PathVariable String docId) {
    return kbService.getStatus(docId);  // PENDING / INDEXING / READY / FAILED
}
```

### Case 2: 纯向量检索（找相关文档块）

```java
@GetMapping("/search")
public List<SearchHit> search(@RequestParam String q) {
    return searchService.search(q, "default", 10);
}

// SearchHit { id, content, score, metadata, source }
// 返回 top-10 最相关的文档块, score 越大越相关
```

### Case 3: 多轮对话（RAG + session 管理）

```java
// 创建会话
ChatSession session = chatService.createSession("default", "user-1001", "技术支持");

// 多轮对话
ChatResponse r1 = chatService.chatInSession(session.getId(), "Apache Kafka 是什么？");
System.out.println(r1.getAnswer());                    // 含引用

ChatResponse r2 = chatService.chatInSession(session.getId(), "它和 RabbitMQ 的区别？");
System.out.println(r2.getAnswer());                    // 自动带上文 + 引用

// 历史
List<ChatMessage> history = chatService.getHistory(session.getId());
```

### Case 4: 图谱检索（实体关系挖掘）

```java
List<GraphQueryResult> relations = kbService.graphQuery(
    "default",
    "MATCH (p:Person)-[r:WORKS_AT]->(c:Company) WHERE p.name = '张三' RETURN r",
    100
);

// 返回实体 + 关系三元组
for (GraphQueryResult r : relations) {
    System.out.println(r.getFrom() + " --" + r.getType() + "--> " + r.getTo());
}
```

### Case 5: 自定义 LLM Provider

```java
@Component
public class MyCustomLLMProvider implements LLMProvider {

    @Override
    public String providerName() { return "my-custom"; }

    @Override
    public ChatResponse complete(List<ChatMessage> messages, LLMOptions opts) {
        // 调用你自己的 LLM (本地 / 私有云 / Qwen 等)
        String prompt = messages.get(messages.size() - 1).getContent();
        String answer = callMyLLM(prompt);
        return ChatResponse.of(answer, "my-custom");
    }
}

// application.yml
// z.kb.llm.provider: my-custom
```

### Case 6: 完整 RAG with Re-ranking

```yaml
z:
  kb:
    vector:
      top-k: 50                  # 1st stage 召回 50 个
    rerank:
      enabled: true
      provider: bge              # bge-reranker-base / cohere / cross-encoder
      model: BAAI/bge-reranker-base
      top-k: 5                   # 2nd stage 重排后取 top-5
```

### Case 7: 多租户（按 workspace 隔离）

```yaml
z:
  kb:
    multi-tenant:
      enabled: true
      workspaces:
        - id: company-a
          embedding-key: ${COMPANY_A_KEY}
        - id: company-b
          embedding-key: ${COMPANY_B_KEY}
```

```java
// 按 workspace 隔离检索
List<SearchHit> hitsA = searchService.search("Q1", "company-a", 10);
List<SearchHit> hitsB = searchService.search("Q1", "company-b", 10);
```

---

## 🏗️ 项目结构

```
z-kb/
├── pom.xml                       # 自给自足 parent
├── z-kb-api/                     # SPI 接口
├── z-kb-core/                    # 默认实现 (TF-IDF + 抽取式)
├── z-kb-vector/                  # z-vector 集成
├── z-kb-graph/                   # z-graph 集成
├── z-kb-storage/                 # JDBC 文档存储
├── z-kb-protocol/                # 通信协议
├── z-kb-ingest/                  # 多格式文档解析
├── z-kb-modeling/                # 实体抽取 + 关系建模
├── z-kb-spring-boot-starter/     # Spring Boot 自动装配
├── z-kb-web/                     # React + AntD 可视化
└── README.md
```

---

## 🔧 高级配置

### 完整 application.yml

```yaml
z:
  kb:
    enabled: true
    workspace: default

    embedding:
      provider: openai             # tfidf / openai / qwen / glm
      api-key: ${OPENAI_API_KEY}
      base-url: https://api.openai.com/v1
      model: text-embedding-3-small
      dimension: 1536
      batch-size: 32
      timeout-ms: 30000

    llm:
      provider: openai              # openai / qwen / glm / ollama
      api-key: ${OPENAI_API_KEY}
      base-url: https://api.openai.com/v1
      model: gpt-4o-mini
      temperature: 0.3
      max-tokens: 2000
      timeout-ms: 60000

    chunking:
      strategy: paragraph           # paragraph / fixed / sentence
      chunk-size: 512               # 字符
      overlap: 50                   # 重叠

    vector:
      backend: z-vector             # z-vector / milvus / qdrant
      collection-name: kb-default
      top-k: 10
      distance: cosine              # cosine / l2 / ip

    rerank:
      enabled: true
      provider: bge
      model: BAAI/bge-reranker-base
      top-k: 5

    storage:
      type: jdbc                    # jdbc / json
      jdbc-url: jdbc:mysql://localhost:3306/kb
      username: kb
      password: ${DB_PASSWORD}

    observability:
      log-prompts: false            # 是否记录 prompt
      log-completions: false
```

### Embedded Tomcat 启动（z-kb-web 内置）

```bash
java -jar z-kb-web-1.0.1.jar
# 默认端口 8080, 访问 http://localhost:8080
```

---

## 🐳 Docker Compose

```yaml
services:
  z-vector:
    image: ghcr.io/z-opc-foundation/z-vector:1.0.1
    ports: ["8080:8080"]

  z-graph:
    image: ghcr.io/z-opc-foundation/z-graph:1.0.1
    ports: ["8182:8182"]

  z-kb:
    image: ghcr.io/z-opc-foundation/z-kb:1.0.1
    ports: ["8081:8080"]
    depends_on: [z-vector, z-graph]
    environment:
      Z_KB_VECTOR_BACKEND: z-vector
      Z_KB_VECTOR_URI: http://z-vector:8080
      OPENAI_API_KEY: ${OPENAI_API_KEY}

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: kb
```

---

## 📊 性能基准（4 核 8G）

| 操作 | 性能 |
|---|---|
| TF-IDF 嵌入（512 维）| 200 docs/s |
| OpenAI text-embedding-3-small 批量 | 500 docs/s (网络受限于 API) |
| 向量检索（HNSW, 100k 向量）| < 10ms P99 |
| RAG 问答端到端 | 1.2s P99 (含 LLM 1s + 检索 10ms) |
| 并发问答 | 80 QPS (LLM API 限制) |

---

## 🧪 完整测试覆盖

```
单元测试:       421 PASS
集成测试:       87 PASS  (含 z-vector + z-graph live)
Spring Boot:   14 PASS  (context load + AutoConfiguration)
LLM 集成:      23 PASS  (mock OpenAI / Qwen / GLM)
```

---

## 📚 详细文档

- [完整 application.yml 参考](docs/CONFIGURATION.md)
- [Embedding Provider 切换](docs/EMBEDDING_PROVIDERS.md)
- [LLM Provider 切换](docs/LLM_PROVIDERS.md)
- [REST API 索引](docs/API.md)
- [图谱查询语法](docs/GRAPH_QUERY.md)
- [可视化控制台 z-kb-web](docs/CONSOLE.md)
- [多租户部署](docs/MULTI_TENANT.md)
- [运维手册](docs/OPERATIONS.md)

---

## 🤝 贡献

```bash
mvn clean verify
# 默认不需要 LLM Key, 走 TF-IDF + 抽取式回答
```

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🔗 相关项目

| 项目 | 关系 |
|---|---|
| [z-cache](https://github.com/z-opc-foundation/z-cache) | 同系列 — 分布式缓存（kb 元数据缓存）|
| [z-vector](https://github.com/z-opc-foundation/z-vector) | z-kb 的向量检索后端 |
| [z-graph](https://github.com/z-opc-foundation/z-graph) | z-kb 的图谱检索后端 |
| [z-mq](https://github.com/z-opc-foundation/z-mq) | z-kb 异步导入文档用 |
| [z-rpc](https://github.com/z-opc-foundation/z-rpc) | z-kb 可作为独立服务，RPC 接入 |
| [z-boot](https://github.com/z-opc-foundation/z-boot) | 同系列 — Spring Boot Starter 聚合 + BOM |

> **通过 [z-boot-kb-starter](https://central.sonatype.com/artifact/io.github.yuku123/z-boot-kb-starter) 可以一行 import 集成 z-kb + 自动锁定版本**

---

## 📮 联系

- GitHub Issues: 提交 bug / feature request
- Email: yuku123@users.noreply.github.com
