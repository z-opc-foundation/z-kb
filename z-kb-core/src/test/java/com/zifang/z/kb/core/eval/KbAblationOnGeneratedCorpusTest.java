package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.chunker.Chunker;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.parser.MarkdownParser;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 在 LLM 生成的 6 篇语料 + 30 条标注集上跑检索侧消融。
 *
 * <p>与 {@link KbRetrievalAblationTest} 的区别在于语料规模与题目来源：这份语料由
 * {@code _eval/gen_corpus.py} 用 .249 上的 Ollama 生成，每篇配 4 道「避开原文用词」的
 * 同义改写题 + 1 道知识库外拒答题。
 */
class KbAblationOnGeneratedCorpusTest {

    private static final String WORKSPACE = "eval2";
    private static final String[] DOC_KEYS =
            {"redis-cache", "es-shard", "mq-order", "pg-partition", "kafka-lag", "nginx-upstream"};

    private static HybridSearcher searcher;
    private static TfIdfEmbeddingProvider embedder;
    private static List<Chunk> allChunks;
    private static EvalDataset dataset;

    @BeforeAll
    static void setUp() {
        InMemoryStores.Vector vectorStore = new InMemoryStores.Vector();
        InMemoryStores.Graph graphStore = new InMemoryStores.Graph();
        Bm25Searcher bm25 = new Bm25Searcher();
        embedder = new TfIdfEmbeddingProvider();
        EntityExtractor entityExtractor = new EntityExtractor();
        searcher = new HybridSearcher(vectorStore, graphStore, bm25, embedder, entityExtractor);

        MarkdownParser parser = new MarkdownParser();
        Chunker chunker = new Chunker();
        allChunks = new ArrayList<>();
        for (String key : DOC_KEYS) {
            MarkdownParser.ParseResult parsed = parser.parse(readResource("/eval2/corpus/corpus-" + key + ".md"));
            Document doc = new Document();
            doc.setId("doc-" + key);
            doc.setTitle(parsed.title);
            doc.setBody(parsed.body);
            doc.setWorkspace(WORKSPACE);
            allChunks.addAll(chunker.chunk(doc));
        }
        assertFalse(allChunks.isEmpty());

        List<String> contents = new ArrayList<>(allChunks.size());
        for (Chunk c : allChunks) {
            contents.add(c.getContent() == null ? "" : c.getContent());
        }
        embedder.trainIdf(contents);
        for (Chunk c : allChunks) {
            c.setEmbedding(embedder.embed(c.getContent()));
        }
        vectorStore.createCollection(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, embedder.dimension());
        vectorStore.upsert(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, allChunks);
        bm25.addChunks(allChunks);
        for (Chunk c : allChunks) {
            for (Entity e : entityExtractor.extract(c)) {
                e.setWorkspace(WORKSPACE);
                graphStore.upsertEntity(e);
            }
        }

        dataset = EvalDataset.parse(readResource("/eval2/golden-set-v2.json"));
        Map<String, List<String>> byDoc = new LinkedHashMap<>();
        for (Chunk c : allChunks) {
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
    }

    @Test
    @DisplayName("6 篇语料 24 条标注上的四臂消融")
    void ablation() {
        SearchService service = new SearchService() {
            @Override
            public SearchResult search(SearchQuery query) {
                return searcher.search(query);
            }
        };
        List<RetrievalEvalReport> reports = new AblationRunner(
                new RetrievalEvaluator(service, embedder.providerName()))
                .run(dataset, AblationRunner.standardArms(), WORKSPACE, 10, 5);

        for (RetrievalEvalReport r : reports) {
            RetrievalMetrics.Aggregate a = r.getOverall();
            System.out.println(String.format(
                    "[abl2] %-8s HitRate@%d=%.3f Recall=%.3f MRR=%.3f NDCG=%.3f n=%d empty=%d",
                    r.getMode(), r.getK(), a.hitRate, a.recall, a.mrr, a.ndcg, a.sampleSize,
                    r.getEmptyResultCases()));
        }
        System.out.println("[abl2] " + AblationRunner.headline(reports, SearchMode.FUSION, SearchMode.KEYWORD));

        // 各臂样本量必须一致，否则对照不成立
        for (RetrievalEvalReport r : reports) {
            assertTrue(r.getOverall().sampleSize > 0, r.getMode() + " 无样本");
            assertTrue(r.getOverall().sampleSize == reports.get(0).getOverall().sampleSize,
                    r.getMode() + " 样本量与其他臂不一致");
        }
        // 向量路必须真的有贡献，否则又回到「向量恒空」的老状态
        RetrievalEvalReport fusion = reports.get(3);
        assertTrue(fusion.getRouteHitCounts().getOrDefault("vector", 0) > 0, "FUSION 下向量路贡献为 0");
    }

    private static String readResource(String path) {
        try (InputStream in = KbAblationOnGeneratedCorpusTest.class.getResourceAsStream(path)) {
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
        } catch (Exception e) {
            throw new IllegalStateException("读取测试资源失败: " + path, e);
        }
    }
}
