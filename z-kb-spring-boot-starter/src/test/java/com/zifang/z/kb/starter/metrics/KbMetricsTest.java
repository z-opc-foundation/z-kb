package com.zifang.z.kb.starter.metrics;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.KbMetrics;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;
import com.zifang.z.kb.starter.service.DefaultSearchService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 埋点不能只是「有代码」，必须证明它真能报出信号。
 *
 * <p>最要紧的一条是 {@code z_kb.search.hits.missing.content} —— 融合丢正文那类缺陷
 * 在线上不会报任何错，问答「看起来正常」，只有这个计数器能发现。
 */
class KbMetricsTest {

    private static final String WS = "metrics";

    @Test
    @DisplayName("命中缺正文时计数必须非零")
    void missingContentCounterFires() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        // BM25 不喂语料 → 向量路独占命中 → 正文必为空
        DefaultSearchService service = service(registry, false);
        service.search(query(SearchMode.VECTOR));

        assertEquals(1.0, counter(registry, "z_kb.search.hits.missing.content"),
                "命中缺正文却没有计数 —— 这条指标形同虚设");
        assertEquals(1.0, counter(registry, "z_kb.search.hits"));
        assertTrue(timerCount(registry, "z_kb.search") > 0, "未记录检索耗时");
    }

    @Test
    @DisplayName("正常命中时不产生缺正文计数")
    void missingContentCounterSilentWhenHealthy() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        DefaultSearchService service = service(registry, true);
        service.search(query(SearchMode.KEYWORD));

        assertEquals(0.0, counter(registry, "z_kb.search.hits.missing.content"),
                "有正文却报缺正文，指标本身有问题");
    }

    @Test
    @DisplayName("检索降级按路数计数")
    void degradedRoutesCounter() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        KbMetrics metrics = new MicrometerKbMetrics(registry);
        metrics.recordSearch("FUSION", 12, 3, 0, 2);
        metrics.recordSearch("FUSION", 8, 1, 0, 1);

        assertEquals(3.0, registry.get("z_kb.search.degraded.routes")
                .tag("mode", "FUSION").counter().count());
    }

    @Test
    @DisplayName("问答按降级档位与 token 分向累计")
    void chatMetrics() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        KbMetrics metrics = new MicrometerKbMetrics(registry);
        metrics.recordChat("extractive-llm-failed", 0, 0, 30);
        metrics.recordChat("qwen2.5", 1200, 300, 900);

        assertEquals(1.0, registry.get("z_kb.chat").tag("model", "extractive-llm-failed").timer().count());
        assertEquals(1200.0, registry.get("z_kb.chat.tokens")
                .tag("model", "qwen2.5").tag("direction", "prompt").counter().count());
        assertEquals(300.0, registry.get("z_kb.chat.tokens")
                .tag("model", "qwen2.5").tag("direction", "completion").counter().count());
    }

    @Test
    @DisplayName("没有埋点实现时检索照常工作")
    void worksWithoutMetrics() {
        DefaultSearchService service = service(null, true);
        SearchResult r = service.search(query(SearchMode.KEYWORD));
        assertEquals(1, r.getTotalHits());
    }

    private static DefaultSearchService service(SimpleMeterRegistry registry, boolean feedBm25) {
        Chunk chunk = new Chunk();
        chunk.setId("c1");
        chunk.setDocumentId("d1");
        chunk.setWorkspace(WS);
        chunk.setContent("缓存穿透可以用布隆过滤器拦截。");

        TfIdfEmbeddingProvider embedder = new TfIdfEmbeddingProvider();
        embedder.trainIdf(Collections.singletonList(chunk.getContent()));
        chunk.setEmbedding(embedder.embed(chunk.getContent()));

        ChunkVectorStore vectorStore = new NoopVectorStore();
        vectorStore.createCollection(WS, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, embedder.dimension());
        vectorStore.upsert(WS, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION,
                Collections.singletonList(chunk));

        Bm25Searcher bm25 = new Bm25Searcher();
        if (feedBm25) {
            bm25.addChunks(Collections.singletonList(chunk));
        }

        // 图谱路本测试用不到（KEYWORD / VECTOR 模式），传 null 是 HybridSearcher 允许的
        HybridSearcher searcher = new HybridSearcher(vectorStore, null,
                bm25, embedder, new EntityExtractor());
        KbMetrics metrics = registry == null ? null : new MicrometerKbMetrics(registry);
        return new DefaultSearchService(searcher, metrics);
    }

    private static SearchQuery query(SearchMode mode) {
        SearchQuery q = new SearchQuery();
        q.setQuery("缓存穿透");
        q.setWorkspace(WS);
        q.setMode(mode);
        q.setTopK(5);
        return q;
    }

    private static double counter(SimpleMeterRegistry registry, String name) {
        Counter c = registry.find(name).counter();
        return c == null ? 0.0 : c.count();
    }

    private static long timerCount(SimpleMeterRegistry registry, String name) {
        Timer t = registry.find(name).timer();
        return t == null ? 0 : t.count();
    }

    /** 只实现检索链路用到的方法：固定返回一个按 id 命中的 match */
    private static final class NoopVectorStore implements ChunkVectorStore {
        private final Map<String, Chunk> chunks = new HashMap<String, Chunk>();
        private boolean created;

        @Override
        public void createCollection(String workspace, String collectionName, int dimension) {
            created = true;
        }

        @Override
        public boolean hasCollection(String workspace, String collectionName) {
            return created;
        }

        @Override
        public boolean deleteCollection(String workspace, String collectionName) {
            created = false;
            return true;
        }

        @Override
        public void upsert(String workspace, String collectionName, List<Chunk> list) {
            for (Chunk c : list) {
                chunks.put(c.getId(), c);
            }
        }

        @Override
        public List<VectorMatch> search(String workspace, String collectionName, float[] query,
                                        int topK, Map<String, Object> filter) {
            List<VectorMatch> out = new ArrayList<VectorMatch>();
            for (Chunk c : chunks.values()) {
                out.add(new VectorMatch(c.getId(), c.getDocumentId(), 0.9f, Collections.<String, Object>emptyMap()));
            }
            return out.subList(0, Math.min(topK, out.size()));
        }

        @Override public boolean delete(String w, String c, String id) { return chunks.remove(id) != null; }
        @Override public int deleteByDocument(String w, String c, String d) { return 0; }
        @Override public long count(String w, String c) { return chunks.size(); }
        @Override public void close() { chunks.clear(); }
    }
}
