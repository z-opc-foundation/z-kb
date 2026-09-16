package com.zifang.z.kb.starter.service;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.DocumentStatus;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.GraphQueryResult;
import com.zifang.z.kb.api.ImportResult;
import com.zifang.z.kb.api.IndexRequest;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.KBStatistics;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.Relation;
import com.zifang.z.kb.api.Workspace;
import com.zifang.z.kb.core.chunker.Chunker;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.extractor.RelationExtractor;
import com.zifang.z.kb.core.parser.MarkdownParser;
import com.zifang.z.kb.core.parser.WikilinkExtractor;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.api.EmbeddingProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 默认知识库服务实现 — 协调所有组件。
 *
 * <p>导入流程：parse → chunk → extract entities → extract relations → embed → upsert。
 */
public class DefaultKnowledgeBaseService implements KnowledgeBaseService {

    private static final Logger log = LoggerFactory.getLogger(DefaultKnowledgeBaseService.class);
    private static final String VECTOR_COLLECTION = "chunks";

    private final MarkdownParser parser;
    private final Chunker chunker;
    private final EntityExtractor entityExtractor;
    private final RelationExtractor relationExtractor;
    private final EmbeddingProvider embeddingProvider;
    private final ChunkVectorStore vectorStore;
    private final KnowledgeGraphStore graphStore;
    private final DocumentRepository documentRepository;
    private final Bm25Searcher bm25Searcher;

    public DefaultKnowledgeBaseService(MarkdownParser parser, Chunker chunker,
                                         EntityExtractor entityExtractor, RelationExtractor relationExtractor,
                                         EmbeddingProvider embeddingProvider, ChunkVectorStore vectorStore,
                                         KnowledgeGraphStore graphStore, DocumentRepository documentRepository,
                                         Bm25Searcher bm25Searcher) {
        this.parser = parser;
        this.chunker = chunker;
        this.entityExtractor = entityExtractor;
        this.relationExtractor = relationExtractor;
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
        this.graphStore = graphStore;
        this.documentRepository = documentRepository;
        this.bm25Searcher = bm25Searcher;
        // 启动时自动重建索引（向量 + BM25），让持久化的 chunk 数据可被搜索
        try {
            rebuildIndicesFromStorage();
        } catch (Exception e) {
            log.warn("启动重建索引失败：{}", e.getMessage());
        }
    }

    /**
     * 从持久化存储重建向量 + BM25 索引。
     * 这样重启后已索引的文档仍然可被搜索到，避免每次都要重新 ingest。
     */
    private void rebuildIndicesFromStorage() {
        log.info("启动时重建索引（从持久化存储加载）...");
        long start = System.currentTimeMillis();
        int totalDocs = 0;
        int totalChunks = 0;

        for (Workspace ws : documentRepository.listWorkspaces()) {
            String workspaceName = ws.getName();
            List<Document> docs = documentRepository.listByWorkspace(workspaceName, 0, Integer.MAX_VALUE);
            if (docs == null || docs.isEmpty()) continue;

            // 收集该 workspace 所有 chunk
            List<Chunk> allChunks = new ArrayList<>();
            for (Document d : docs) {
                List<Chunk> chunks = documentRepository.findChunksByDocument(workspaceName, d.getId());
                if (chunks != null) allChunks.addAll(chunks);
            }
            if (allChunks.isEmpty()) continue;

            // 重新计算 embeddings（向量存储在内存）
            if (embeddingProvider instanceof TfIdfEmbeddingProvider) {
                TfIdfEmbeddingProvider tfidf = (TfIdfEmbeddingProvider) embeddingProvider;
                List<String> trainingCorpus = new ArrayList<>();
                for (Chunk c : allChunks) {
                    if (c.getContent() != null) trainingCorpus.add(c.getContent());
                }
                if (!trainingCorpus.isEmpty()) tfidf.trainIdf(trainingCorpus);
            }
            List<float[]> embeddings = embeddingProvider.embedBatch(
                    allChunks.stream().map(c -> c.getContent() != null ? c.getContent() : "").collect(Collectors.toList())
            );
            for (int i = 0; i < allChunks.size() && i < embeddings.size(); i++) {
                allChunks.get(i).setEmbedding(embeddings.get(i));
            }

            // 重建向量集合
            String collection = workspaceName + "_" + VECTOR_COLLECTION;
            if (!vectorStore.hasCollection(workspaceName, VECTOR_COLLECTION)) {
                vectorStore.createCollection(workspaceName, VECTOR_COLLECTION, embeddingProvider.dimension());
            }
            vectorStore.upsert(workspaceName, VECTOR_COLLECTION, allChunks);

            // 重建 BM25 索引
            bm25Searcher.addChunks(allChunks);

            totalDocs += docs.size();
            totalChunks += allChunks.size();
            log.info("工作台 {} 重建索引完成：docs={}, chunks={}", workspaceName, docs.size(), allChunks.size());
        }
        long elapsed = System.currentTimeMillis() - start;
        log.info("启动重建索引完成：总 docs={}, chunks={}, 耗时 {}ms", totalDocs, totalChunks, elapsed);
    }

    // ==================== 文档管理 ====================

    @Override
    public ImportResult indexDocument(IndexRequest request) {
        long start = System.currentTimeMillis();
        ImportResult result = new ImportResult();
        Document doc = request.getDocument();
        if (doc == null) {
            result.setSuccess(false);
            result.setErrorMessage("document is null");
            return result;
        }
        String workspace = request.getWorkspace() != null ? request.getWorkspace() : doc.getWorkspace();
        if (workspace == null) workspace = "default";
        doc.setWorkspace(workspace);
        if (request.getTags() != null && !request.getTags().isEmpty()) {
            doc.setTags(request.getTags());
        }

        // ============ 去重逻辑：如果同 path 已存在，先清理旧版本 ============
        // 用 path + workspace 作为幂等键，避免重复 ingest 时数据翻倍
        boolean isOverwrite = request.isOverwrite();
        Document oldDoc = null;
        if (isOverwrite && doc.getPath() != null && !doc.getPath().isEmpty()) {
            oldDoc = documentRepository.findByPath(workspace, doc.getPath());
        }
        if (oldDoc != null) {
            // 复用旧 ID，保证下游 chunks/entities/relations 与之前 ID 一致
            doc.setId(oldDoc.getId());
            // 清理旧 chunks（同时也会从 vector store 移除）
            documentRepository.deleteChunksByDocument(workspace, oldDoc.getId());
            // 清理旧文档关联的 entities / relations
            try {
                graphStore.deleteByDocument(workspace, oldDoc.getId());
            } catch (Exception ignore) {
                // 旧 graph store 可能不支持 deleteByDocument
            }
            log.info("文档路径 {} 已存在（id={}），将覆盖重建", doc.getPath(), oldDoc.getId());
        }

        try {
            doc.setStatus(DocumentStatus.PARSING);
            // 1. 解析（如果有 content 但没有 body）
            if (doc.getBody() == null || doc.getBody().isEmpty()) {
                MarkdownParser.ParseResult pr = parser.parse(doc.getContent());
                doc.setBody(pr.body);
                doc.setFrontmatter(pr.frontmatter);
                if (doc.getTitle() == null) doc.setTitle(pr.title);
                if (doc.getTags() == null || doc.getTags().isEmpty()) doc.setTags(pr.tags);
                doc.setWordCount(pr.wordCount);
            }

            // 2. 抽取 wikilink
            WikilinkExtractor wikilinkExtractor = new WikilinkExtractor();
            List<String> wikilinks = wikilinkExtractor.extract(doc.getBody());

            // 3. 分块
            doc.setStatus(DocumentStatus.CHUNKING);
            List<Chunk> chunks = chunker.chunk(doc);
            // 给 chunk 注入 wikilink
            for (Chunk c : chunks) {
                List<String> chunkWikilinks = wikilinkExtractor.extract(c.getContent());
                c.setWikilinkTargets(chunkWikilinks);
            }

            // 4. 实体抽取
            List<Entity> docEntities = new ArrayList<>();
            List<Relation> docRelations = new ArrayList<>();
            if (request.isExtractGraph()) {
                for (Chunk chunk : chunks) {
                    List<Entity> chunkEntities = entityExtractor.extract(chunk);
                    for (Entity e : chunkEntities) {
                        // 设置 workspace
                        e.setWorkspace(workspace);
                        if (!docEntities.contains(e)) docEntities.add(e);
                    }
                    List<Relation> chunkRelations = relationExtractor.extract(chunk, chunkEntities);
                    for (Relation r : chunkRelations) r.setWorkspace(workspace);
                    docRelations.addAll(chunkRelations);
                }
            }

            // 5. Embedding（批量）
            doc.setStatus(DocumentStatus.EMBEDDING);
            List<String> texts = new ArrayList<>(chunks.size());
            for (Chunk c : chunks) texts.add(c.getContent() != null ? c.getContent() : "");
            List<float[]> embeddings;
            if (embeddingProvider instanceof TfIdfEmbeddingProvider) {
                // TF-IDF：先训练 IDF，再向量化
                TfIdfEmbeddingProvider tfidf = (TfIdfEmbeddingProvider) embeddingProvider;
                List<String> trainingCorpus = new ArrayList<>();
                for (Chunk c : chunks) {
                    if (c.getContent() != null) trainingCorpus.add(c.getContent());
                }
                if (!trainingCorpus.isEmpty()) tfidf.trainIdf(trainingCorpus);
            }
            embeddings = embeddingProvider.embedBatch(texts);
            for (int i = 0; i < chunks.size() && i < embeddings.size(); i++) {
                chunks.get(i).setEmbedding(embeddings.get(i));
            }

            // 6. 持久化（Repository）
            documentRepository.save(doc);
            documentRepository.saveChunks(chunks);

            // 7. 向量入库（先删同 docId 的旧向量，避免重复）
            String collection = workspace + "_" + VECTOR_COLLECTION;
            if (!vectorStore.hasCollection(workspace, VECTOR_COLLECTION)) {
                vectorStore.createCollection(workspace, VECTOR_COLLECTION, embeddingProvider.dimension());
            }
            vectorStore.upsert(workspace, VECTOR_COLLECTION, chunks);

            // 8. 全文索引（追加新文档的 chunks）
            bm25Searcher.addChunks(documentRepository.findChunksByDocument(workspace, doc.getId()));

            // 9. 图谱入库
            if (request.isExtractGraph()) {
                graphStore.upsertEntities(docEntities);
                graphStore.upsertRelations(docRelations);
            }

            doc.setStatus(DocumentStatus.INDEXED);
            documentRepository.save(doc);

            result.setDocumentId(doc.getId());
            result.setTitle(doc.getTitle());
            result.setChunkCount(chunks.size());
            result.setEntityCount(docEntities.size());
            result.setRelationCount(docRelations.size());
            result.setSuccess(true);
            result.setElapsedMillis(System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Index failed for document {}", doc.getId(), e);
            doc.setStatus(DocumentStatus.FAILED);
            try { documentRepository.save(doc); } catch (Exception ignored) {}
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            result.setElapsedMillis(System.currentTimeMillis() - start);
        }
        return result;
    }

    @Override
    public List<ImportResult> indexBatch(List<IndexRequest> requests) {
        List<ImportResult> results = new ArrayList<>();
        if (requests == null) return results;
        for (IndexRequest req : requests) results.add(indexDocument(req));
        return results;
    }

    @Override
    public ImportResult importMarkdown(String workspace, String title, String markdown,
                                        List<String> tags, String author) {
        Document doc = parser.parseIntoDocument(markdown, workspace, tags);
        if (title != null) doc.setTitle(title);
        if (author != null) doc.setAuthor(author);
        IndexRequest req = new IndexRequest();
        req.setDocument(doc);
        req.setWorkspace(workspace);
        return indexDocument(req);
    }

    @Override
    public List<ImportResult> importMarkdownDir(String workspace, String directoryPath) {
        List<ImportResult> results = new ArrayList<>();
        try (Stream<Path> stream = Files.walk(Paths.get(directoryPath))) {
            stream.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".md"))
                    .forEach(p -> {
                        try {
                            String content = Files.readString(p);
                            Document doc = parser.parseIntoDocument(content, workspace, null);
                            doc.setPath(workspace + ":" + p.toString());
                            IndexRequest req = new IndexRequest();
                            req.setDocument(doc);
                            req.setWorkspace(workspace);
                            results.add(indexDocument(req));
                        } catch (IOException e) {
                            ImportResult r = new ImportResult();
                            r.setTitle(p.toString());
                            r.setSuccess(false);
                            r.setErrorMessage("Read failed: " + e.getMessage());
                            results.add(r);
                        }
                    });
        } catch (IOException e) {
            throw new KBException("Failed to walk directory: " + e.getMessage(), e);
        }
        return results;
    }

    @Override
    public boolean deleteDocument(String workspace, String documentId) {
        Document d = documentRepository.findById(workspace, documentId);
        if (d == null) return false;
        // 级联删除
        vectorStore.deleteByDocument(workspace, VECTOR_COLLECTION, documentId);
        graphStore.deleteByDocument(workspace, documentId);
        bm25Searcher.deleteByDocument(workspace, documentId);
        documentRepository.deleteChunksByDocument(workspace, documentId);
        documentRepository.hardDelete(workspace, documentId);
        return true;
    }

    @Override
    public int deleteAll(String workspace) {
        List<Document> all = documentRepository.listByWorkspace(workspace, 0, Integer.MAX_VALUE);
        int deleted = 0;
        for (Document d : all) {
            if (deleteDocument(workspace, d.getId())) deleted++;
        }
        return deleted;
    }

    @Override
    public Document getDocument(String workspace, String id) {
        return documentRepository.findById(workspace, id);
    }

    @Override
    public List<Document> listDocuments(String workspace, int offset, int limit) {
        return documentRepository.listByWorkspace(workspace, offset, limit);
    }

    @Override
    public List<Document> listDocumentsByTags(String workspace, List<String> tags, int offset, int limit) {
        return documentRepository.listByTags(workspace, tags, offset, limit);
    }

    @Override
    public long countDocuments(String workspace) {
        return documentRepository.countByWorkspace(workspace);
    }

    @Override
    public Workspace createWorkspace(String name, String description) {
        Workspace existing = documentRepository.getWorkspaceByName(name);
        if (existing != null) return existing;
        Workspace w = new Workspace(name);
        w.setDescription(description);
        return documentRepository.createWorkspace(w);
    }

    @Override
    public Workspace getWorkspace(String name) {
        return documentRepository.getWorkspaceByName(name);
    }

    @Override
    public List<Workspace> listWorkspaces() {
        List<Workspace> list = documentRepository.listWorkspaces();
        // 实时填充每个工作台的统计计数（避免列表显示陈旧数据）
        for (Workspace ws : list) {
            try {
                ws.setDocumentCount(documentRepository.countByWorkspace(ws.getName()));
                Map<String, Long> graphStats = graphStore.stats(ws.getName());
                ws.setEntityCount(graphStats.getOrDefault("nodes", 0L));
                ws.setRelationCount(graphStats.getOrDefault("edges", 0L));
            } catch (Exception ignore) {
                // 单个工作台统计失败不影响整体
            }
        }
        return list;
    }

    @Override
    public List<Chunk> getChunks(String workspace, String documentId) {
        return documentRepository.findChunksByDocument(workspace, documentId);
    }

    @Override
    public ImportResult reindex(String workspace, String documentId) {
        Document d = getDocument(workspace, documentId);
        if (d == null) {
            ImportResult r = new ImportResult();
            r.setSuccess(false);
            r.setErrorMessage("Document not found");
            return r;
        }
        // 清理
        vectorStore.deleteByDocument(workspace, VECTOR_COLLECTION, documentId);
        graphStore.deleteByDocument(workspace, documentId);
        bm25Searcher.deleteByDocument(workspace, documentId);
        documentRepository.deleteChunksByDocument(workspace, documentId);
        IndexRequest req = new IndexRequest();
        req.setDocument(d);
        req.setWorkspace(workspace);
        return indexDocument(req);
    }

    @Override
    public List<Entity> listEntities(String workspace, int limit) {
        List<Entity> result = graphStore.listAllEntities(workspace, limit);
        // 加 frequency 修正 importance
        for (Entity e : result) {
            if (e.getImportance() == 0) e.setImportance(Math.min(1.0, e.getFrequency() / 10.0));
        }
        return result;
    }

    @Override
    public Entity getEntity(String workspace, String name) {
        return graphStore.findEntity(workspace, name);
    }

    @Override
    public List<Entity> getNeighbors(String workspace, String entityName, int depth) {
        java.util.Set<Entity> result = graphStore.traverse(workspace, entityName, depth);
        return new ArrayList<>(result);
    }

    @Override
    public GraphQueryResult getSubgraph(String workspace, List<String> entityNames, int depth) {
        return graphStore.subgraph(workspace, entityNames, depth);
    }

    @Override
    public KBStatistics statistics(String workspace) {
        KBStatistics stats = new KBStatistics();
        stats.setWorkspace(workspace);
        stats.setDocumentCount(documentRepository.countByWorkspace(workspace));
        List<Document> docs = documentRepository.listByWorkspace(workspace, 0, Integer.MAX_VALUE);
        long totalChunks = 0;
        long totalBytes = 0;
        Map<String, Long> tagCloud = new LinkedHashMap<>();
        for (Document d : docs) {
            List<Chunk> chunks = documentRepository.findChunksByDocument(workspace, d.getId());
            totalChunks += chunks.size();
            totalBytes += d.getContent() != null ? d.getContent().length() : 0;
            if (d.getTags() != null) {
                for (String t : d.getTags()) tagCloud.merge(t, 1L, Long::sum);
            }
        }
        stats.setChunkCount(totalChunks);
        stats.setTotalSizeBytes(totalBytes);
        stats.setTagCloud(tagCloud);
        Map<String, Long> gs = graphStore.stats(workspace);
        stats.setEntityCount(gs.getOrDefault("nodes", 0L));
        stats.setRelationCount(gs.getOrDefault("edges", 0L));
        stats.setEmbeddingCount(totalChunks);
        stats.setEmbeddingProvider(embeddingProvider.providerName());
        stats.setGeneratedAtMs(System.currentTimeMillis());

        // 实体类型分布（按实体 type 聚合）
        Map<String, Long> entityTypeDist = new LinkedHashMap<>();
        try {
            // 用 listAllEntities 一次拉全量，比 listEntitiesByType 循环更快
            java.util.List<com.zifang.z.kb.api.Entity> allEnts = graphStore.listAllEntities(workspace, 10000);
            if (allEnts != null) {
                for (com.zifang.z.kb.api.Entity e : allEnts) {
                    String t = e.getType() == null ? "UNKNOWN" : e.getType().name();
                    entityTypeDist.merge(t, 1L, Long::sum);
                }
            }
        } catch (Throwable ignore) {
            // 旧 graph store 可能未实现 listAllEntities，回退到 listEntitiesByType 循环
            try {
                for (com.zifang.z.kb.api.EntityType t : com.zifang.z.kb.api.EntityType.values()) {
                    java.util.List<com.zifang.z.kb.api.Entity> ents = graphStore.listEntitiesByType(workspace, t, 10000);
                    if (ents != null && !ents.isEmpty()) {
                        entityTypeDist.put(t.name(), (long) ents.size());
                    }
                }
            } catch (Throwable ignore2) {}
        }
        stats.setEntityTypeDistribution(entityTypeDist);
        return stats;
    }

    @Override
    public void close() {
        try { vectorStore.close(); } catch (Exception ignored) {}
        try { graphStore.close(); } catch (Exception ignored) {}
    }
}
