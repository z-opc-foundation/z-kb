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
            documentRepository.deleteChunksByDocument(workspace, doc.getId());
            documentRepository.saveChunks(chunks);

            // 7. 向量入库
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
        return documentRepository.listWorkspaces();
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
        return stats;
    }

    @Override
    public void close() {
        try { vectorStore.close(); } catch (Exception ignored) {}
        try { graphStore.close(); } catch (Exception ignored) {}
    }
}
