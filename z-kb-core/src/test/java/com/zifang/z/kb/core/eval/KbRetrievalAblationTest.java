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
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 检索侧端到端消融 — 同时充当三处 P0 缺陷的回归测试。
 *
 * <p>黄金集按<b>文档</b>粒度标注（expectedDocIds），建库时按 chunk 的 documentId 展开成
 * chunk 级 expectedChunkIds。标注只依赖「哪份文档回答了这个问题」，不依赖任何一路检索的排序
 * 输出，因此不会形成自我循环的假高分；分块策略改了也不用重标。
 */
class KbRetrievalAblationTest {

    private static final String WORKSPACE = "eval";
    private static final String[] DOC_KEYS = {"mysql", "k8s", "nacos"};

    private static InMemoryStores.Vector vectorStore;
    private static InMemoryStores.Graph graphStore;
    private static Bm25Searcher bm25;
    private static TfIdfEmbeddingProvider embedder;
    private static HybridSearcher searcher;
    private static List<Chunk> allChunks;
    private static EvalDataset dataset;

    @BeforeAll
    static void setUp() {
        vectorStore = new InMemoryStores.Vector();
        graphStore = new InMemoryStores.Graph();
        bm25 = new Bm25Searcher();
        embedder = new TfIdfEmbeddingProvider();
        EntityExtractor entityExtractor = new EntityExtractor();
        searcher = new HybridSearcher(vectorStore, graphStore, bm25, embedder, entityExtractor);

        MarkdownParser parser = new MarkdownParser();
        Chunker chunker = new Chunker();

        allChunks = new ArrayList<>();
        for (String key : DOC_KEYS) {
            MarkdownParser.ParseResult parsed = parser.parse(readResource("/eval/corpus-" + key + ".md"));

            Document doc = new Document();
            doc.setId("doc-" + key);
            doc.setTitle(parsed.title);
            doc.setBody(parsed.body);
            doc.setWorkspace(WORKSPACE);

            allChunks.addAll(chunker.chunk(doc));
        }
        assertFalse(allChunks.isEmpty(), "分块结果为空，语料或分块器有问题");

        // TF-IDF 必须先在完整语料上训练再统一 embed，否则文档向量与查询向量不在同一 IDF 空间
        List<String> contents = new ArrayList<>(allChunks.size());
        for (Chunk c : allChunks) {
            contents.add(c.getContent() == null ? "" : c.getContent());
        }
        embedder.trainIdf(contents);
        for (Chunk c : allChunks) {
            c.setEmbedding(embedder.embed(c.getContent()));
        }

        // 写入侧同样走共享常量 —— 与检索侧共用一个定义正是 P0-1 的修法
        vectorStore.createCollection(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, embedder.dimension());
        vectorStore.upsert(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, allChunks);
        bm25.addChunks(allChunks);

        for (Chunk c : allChunks) {
            for (Entity e : entityExtractor.extract(c)) {
                e.setWorkspace(WORKSPACE);
                graphStore.upsertEntity(e);
            }
        }

        dataset = EvalDataset.parse(readResource("/eval/golden-set-v1.json"));
        expandDocIdsToChunkIds();
    }

    private static void expandDocIdsToChunkIds() {
        Map<String, List<String>> chunkIdsByDoc = new LinkedHashMap<>();
        for (Chunk c : allChunks) {
            chunkIdsByDoc.computeIfAbsent(c.getDocumentId(), k -> new ArrayList<>()).add(c.getId());
        }
        for (EvalCase c : dataset.getCases()) {
            List<String> expanded = new ArrayList<>();
            for (String docId : c.getExpectedDocIds()) {
                List<String> ids = chunkIdsByDoc.get(docId);
                if (ids != null) {
                    expanded.addAll(ids);
                }
            }
            c.setExpectedChunkIds(expanded);
        }
    }

    private static RetrievalEvalReport run(SearchMode mode, int topK, int k) {
        RetrievalEvaluator evaluator = new RetrievalEvaluator(new SearchService() {
            @Override
            public SearchResult search(SearchQuery query) {
                return searcher.search(query);
            }
        }, embedder.providerName());
        return evaluator.evaluate(dataset, mode, WORKSPACE, topK, k);
    }

    @Test
    @DisplayName("P0-1 回归：写入侧与检索侧必须探测同一个 collection，向量路不再静默恒空")
    void vectorRouteIsNotSilentlyEmpty() {
        RetrievalEvalReport fusion = run(SearchMode.FUSION, 10, 5);

        assertTrue(vectorStore.probedCollections.contains("kb_eval_" + ChunkVectorStore.DEFAULT_CHUNK_COLLECTION),
                "检索侧未探测到写入侧使用的物理 collection，实际探测: " + vectorStore.probedCollections);
        assertFalse(vectorStore.probedCollections.contains("kb_eval_kb_chunks"),
                "检索侧仍在探测修复前的错名 collection");
        assertEquals(0, fusion.getEmptyResultCases(), "存在召回完全为空的用例");
        assertTrue(fusion.getOverall().hitRate > 0, "FUSION 模式下向量路贡献为 0，HitRate 应为 0");
    }

    @Test
    @DisplayName("P0-2 回归：图谱路用抽出的实体名匹配，能召回而不是恒空")
    void graphRouteFindsEntities() {
        RetrievalEvalReport graph = run(SearchMode.GRAPH, 10, 5);
        assertTrue(graph.getOverall().hitRate > 0,
                "GRAPH 模式 HitRate 为 0 —— 整句 query 直接 contains 匹配的老问题没修掉");
    }

    @Test
    @DisplayName("P0-3 回归：embed 是纯函数，查询不再污染语料 IDF")
    void embedDoesNotMutateCorpusState() {
        TfIdfEmbeddingProvider p = new TfIdfEmbeddingProvider();
        p.trainOneDoc("MySQL 索引优化 使用最左前缀");
        Map<String, Integer> before = p.snapshotCorpusState();
        int docsBefore = p.corpusSize();

        p.embed("完全无关的查询文本");
        p.embedBatch(Arrays.asList("另一个查询", "第三个查询"));

        assertEquals(docsBefore, p.corpusSize(), "查询调用改写了已处理文档数");
        assertEquals(before, p.snapshotCorpusState(), "查询调用改写了 DF 统计");
    }

    @Test
    @DisplayName("三路消融：同语料同标注下输出可比的四组指标")
    void ablationAcrossStrategies() {
        List<RetrievalEvalReport> reports = new AblationRunner(
                new RetrievalEvaluator(new SearchService() {
                    @Override
                    public SearchResult search(SearchQuery query) {
                        return searcher.search(query);
                    }
                }, embedder.providerName()))
                .run(dataset, AblationRunner.standardArms(), WORKSPACE, 10, 5);

        assertEquals(4, reports.size());
        for (RetrievalEvalReport r : reports) {
            assertTrue(r.getOverall().sampleSize > 0, r.getMode() + " 无有效样本");
            assertEquals(dataset.getKnowledgeVersion(), r.getKnowledgeVersion(),
                    "报告未带 knowledgeVersion，跨次实验不可比");
        }

        String headline = AblationRunner.headline(reports, SearchMode.FUSION, SearchMode.KEYWORD);
        System.out.println("[ablation] " + headline);
        for (RetrievalEvalReport r : reports) {
            RetrievalMetrics.Aggregate a = r.getOverall();
            System.out.println(String.format("[ablation] %-8s HitRate@%d=%.3f Recall=%.3f MRR=%.3f NDCG=%.3f n=%d",
                    r.getMode(), r.getK(), a.hitRate, a.recall, a.mrr, a.ndcg, a.sampleSize));
        }
    }

    @Test
    @DisplayName("不可答用例不污染召回率分母")
    void unanswerableCasesAreExcludedFromRetrievalScores() {
        RetrievalEvalReport fusion = run(SearchMode.FUSION, 10, 5);
        int scoredCases = 0;
        for (EvalCase c : dataset.getCases()) {
            if (c.isScoredForRetrieval()) scoredCases++;
        }
        assertEquals(scoredCases, fusion.getCases().size(), "不可答用例被计入了召回率");
        assertEquals(scoredCases, fusion.getOverall().sampleSize);
    }

    private static String readResource(String path) {
        try (InputStream in = KbRetrievalAblationTest.class.getResourceAsStream(path)) {
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
