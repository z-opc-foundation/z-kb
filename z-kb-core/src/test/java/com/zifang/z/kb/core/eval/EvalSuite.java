package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.core.chunker.Chunker;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.parser.MarkdownParser;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 一套评测语料：资源目录 + 文档键 + 标注集文件。
 *
 * <p>把「装语料 → 切块 → 训练 IDF → 建索引」这段固定动作收在这里，消融与生成侧
 * 评测共用，避免两套装置各自漂移。
 */
final class EvalSuite {

    final String name;
    final String resourceDir;
    final String workspace;
    final String[] docKeys;

    private HybridSearcher searcher;
    private TfIdfEmbeddingProvider embedder;

    private final String datasetFile;

    private EvalSuite(String name, String resourceDir, String workspace, String datasetFile, String[] docKeys) {
        this.name = name;
        this.resourceDir = resourceDir;
        this.workspace = workspace;
        this.datasetFile = datasetFile;
        this.docKeys = docKeys;
    }

    /**
     * eval2 — 公开技术常识语料。模型自身知识足以作答，检索增益被基准天花板抹平。
     */
    static EvalSuite commonSense() {
        return new EvalSuite("eval2", "/eval2", "eval2", "/eval2/golden-set-v2.json", new String[]{
                "redis-cache", "es-shard", "mq-order", "pg-partition", "kafka-lag", "nginx-upstream"});
    }

    /**
     * eval3 — 长尾私有事实语料（虚构的内部平台 Zorp）。答案含具体阈值/编号，
     * 模型不可能凭自身知识答对，无检索臂必然塌陷，检索增益才有观测空间。
     */
    static EvalSuite longTail() {
        return new EvalSuite("eval3", "/eval3", "eval3", "/eval3/golden-set-v3.json", new String[]{
                "order-timeout", "quota-ladder", "settle-ledger",
                "risk-rulebook", "deploy-gate", "oncall-rota"});
    }

    static List<EvalSuite> all() {
        List<EvalSuite> suites = new ArrayList<>();
        suites.add(commonSense());
        suites.add(longTail());
        return suites;
    }

    /** 装入语料并建好三路索引 */
    void load() {
        InMemoryStores.Vector vectorStore = new InMemoryStores.Vector();
        InMemoryStores.Graph graphStore = new InMemoryStores.Graph();
        Bm25Searcher bm25 = new Bm25Searcher();
        embedder = new TfIdfEmbeddingProvider();
        EntityExtractor entityExtractor = new EntityExtractor();
        // 无 DocumentRepository：正文靠 BM25 路携带，并由 rrfMerge 的保留规则传下去
        searcher = new HybridSearcher(vectorStore, graphStore, bm25, embedder, entityExtractor);

        MarkdownParser parser = new MarkdownParser();
        Chunker chunker = new Chunker();
        List<Chunk> all = new ArrayList<>();
        for (String key : docKeys) {
            MarkdownParser.ParseResult parsed = parser.parse(read(resourceDir + "/corpus/corpus-" + key + ".md"));
            Document doc = new Document();
            doc.setId("doc-" + key);
            doc.setTitle(parsed.title);
            doc.setBody(parsed.body);
            doc.setWorkspace(workspace);
            all.addAll(chunker.chunk(doc));
        }
        if (all.isEmpty()) {
            throw new IllegalStateException("语料为空: " + name);
        }

        List<String> contents = new ArrayList<>(all.size());
        for (Chunk c : all) {
            contents.add(c.getContent() == null ? "" : c.getContent());
        }
        embedder.trainIdf(contents);
        for (Chunk c : all) {
            c.setEmbedding(embedder.embed(c.getContent()));
        }
        vectorStore.createCollection(workspace, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, embedder.dimension());
        vectorStore.upsert(workspace, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, all);
        bm25.addChunks(all);
        for (Chunk c : all) {
            for (Entity e : entityExtractor.extract(c)) {
                e.setWorkspace(workspace);
                graphStore.upsertEntity(e);
            }
        }

        dataset = expandDocIds(EvalDataset.parse(read(datasetFile)), all);
    }

    private EvalDataset dataset;

    EvalDataset dataset() {
        return dataset;
    }

    HybridSearcher searcher() {
        return searcher;
    }

    TfIdfEmbeddingProvider embedder() {
        return embedder;
    }

    /** 标注落在文档粒度，这里展开成 chunk 粒度，使评测不随切块粒度漂移 */
    private static EvalDataset expandDocIds(EvalDataset dataset, List<Chunk> all) {
        Map<String, List<String>> byDoc = new LinkedHashMap<>();
        for (Chunk c : all) {
            byDoc.computeIfAbsent(c.getDocumentId(), k -> new ArrayList<>()).add(c.getId());
        }
        for (EvalCase c : dataset.getCases()) {
            List<String> expanded = new ArrayList<>();
            for (String docId : c.getExpectedDocIds()) {
                List<String> ids = byDoc.get("doc-" + docId);
                if (ids != null) {
                    expanded.addAll(ids);
                }
            }
            c.setExpectedChunkIds(expanded);
        }
        return dataset;
    }

    static String read(String path) {
        try (InputStream in = EvalSuite.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("缺少测试资源: " + path);
            }
            try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                StringBuilder sb = new StringBuilder();
                char[] buf = new char[4096];
                int n;
                while ((n = r.read(buf)) > 0) {
                    sb.append(buf, 0, n);
                }
                return sb.toString();
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("读取测试资源失败: " + path, e);
        }
    }
}
