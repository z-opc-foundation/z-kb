package com.zifang.z.kb.core.search;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 混合检索器 — 协调向量库 + BM25 + 图谱三路召回，使用 RRF 融合。
 *
 * <p>RRF (Reciprocal Rank Fusion) 公式：
 * <pre>RRF(d) = sum( w_i / (k + rank_i(d)) )</pre>
 *
 * <p>设计参考：LightRAG / Hybrid Search / RankFusion。
 */
public class HybridSearcher {

    private static final Logger log = LoggerFactory.getLogger(HybridSearcher.class);

    private final ChunkVectorStore vectorStore;
    private final KnowledgeGraphStore graphStore;
    private final Bm25Searcher bm25Searcher;
    private final EmbeddingProvider embeddingProvider;
    private final EntityExtractor entityExtractor;
    private final DocumentRepository documentRepository;

    /** 向量 Collection 名 — 必须与写入侧一致，取共享常量 */
    private static final String VECTOR_COLLECTION = ChunkVectorStore.DEFAULT_CHUNK_COLLECTION;

    public HybridSearcher(ChunkVectorStore vectorStore,
                           KnowledgeGraphStore graphStore,
                           Bm25Searcher bm25Searcher,
                           EmbeddingProvider embeddingProvider,
                           EntityExtractor entityExtractor) {
        this(vectorStore, graphStore, bm25Searcher, embeddingProvider, entityExtractor, null);
    }

    /**
     * @param documentRepository 用于回填向量/图谱路的 hit 正文，可为 null（此时这些路的 hit 无正文）
     */
    public HybridSearcher(ChunkVectorStore vectorStore,
                           KnowledgeGraphStore graphStore,
                           Bm25Searcher bm25Searcher,
                           EmbeddingProvider embeddingProvider,
                           EntityExtractor entityExtractor,
                           DocumentRepository documentRepository) {
        this.vectorStore = vectorStore;
        this.graphStore = graphStore;
        this.bm25Searcher = bm25Searcher;
        this.embeddingProvider = embeddingProvider;
        this.entityExtractor = entityExtractor;
        this.documentRepository = documentRepository;
    }

    public SearchResult search(SearchQuery q) {
        long start = System.currentTimeMillis();
        // 局部列表而非字段：本类是被多线程共享的单例，挂字段会跨请求串味
        List<String> degraded = new ArrayList<>();
        SearchResult result = new SearchResult();
        result.setQuery(q.getQuery());
        result.setMode(q.getMode());

        // 1. 向量召回
        List<SearchHit> vectorHits = new ArrayList<>();
        if (q.getMode() == SearchMode.VECTOR || q.getMode() == SearchMode.HYBRID || q.getMode() == SearchMode.FUSION) {
            vectorHits = vectorSearch(q, degraded);
        }

        // 2. 关键词召回
        List<SearchHit> keywordHits = new ArrayList<>();
        if (q.getMode() == SearchMode.KEYWORD || q.getMode() == SearchMode.HYBRID || q.getMode() == SearchMode.FUSION) {
            keywordHits = bm25Searcher.search(q);
        }

        // 3. 图谱召回
        List<SearchHit> graphHits = new ArrayList<>();
        List<Entity> matchedEntities = new ArrayList<>();
        if (q.getMode() == SearchMode.GRAPH || q.getMode() == SearchMode.FUSION) {
            graphHits = graphSearch(q, matchedEntities, degraded);
        }

        // 4. 融合
        List<SearchHit> merged;
        switch (q.getMode()) {
            case VECTOR:  merged = vectorHits; break;
            case KEYWORD: merged = keywordHits; break;
            case GRAPH:   merged = graphHits; break;
            case HYBRID:  merged = rrfMerge(q.getRrfK(),
                    weightedList(vectorHits, q.getVectorWeight()),
                    weightedList(keywordHits, q.getKeywordWeight())); break;
            case FUSION:  merged = rrfMerge(q.getRrfK(),
                    weightedList(vectorHits, q.getVectorWeight()),
                    weightedList(keywordHits, q.getKeywordWeight()),
                    weightedList(graphHits, q.getGraphWeight())); break;
            default:      merged = vectorHits; break;
        }

        // 取 topK
        merged.sort(Comparator.comparingDouble(SearchHit::getScore).reversed());
        if (merged.size() > q.getTopK()) merged = merged.subList(0, q.getTopK());

        if (q.isIncludeContent()) {
            backfillContent(merged, q.getWorkspace());
        }

        result.setHits(merged);
        result.setTotalHits(merged.size());
        result.setMatchedEntities(matchedEntities);
        result.getStats().put("vector", vectorHits.size());
        result.getStats().put("keyword", keywordHits.size());
        result.getStats().put("graph", graphHits.size());
        if (!degraded.isEmpty()) {
            result.getStats().put("degradedRoutes", degraded.size());
        }
        result.setElapsedMillis(System.currentTimeMillis() - start);
        return result;
    }

    /**
     * 用 chunk 仓库回填正文。向量路的召回不含正文（向量 payload 只存了 id/ordinal/workspace），
     * 图谱路同理；这两路独占的命中若不回填，调用方拿到的就是一批空壳 hit。
     */
    private void backfillContent(List<SearchHit> hits, String workspace) {
        if (documentRepository == null) return;
        for (SearchHit hit : hits) {
            if (hit.getContent() != null) continue;
            try {
                Chunk c = documentRepository.findChunkById(workspace, hit.getChunkId());
                if (c == null) continue;
                hit.setContent(c.getContent());
                if (hit.getContextTitle() == null) hit.setContextTitle(c.getContextTitle());
                if (hit.getHeadingPath() == null) hit.setHeadingPath(c.getHeadingPath());
            } catch (Exception e) {
                log.warn("回填 chunk 正文失败 {}: {}", hit.getChunkId(), e.getMessage());
            }
        }
    }

    private List<SearchHit> vectorSearch(SearchQuery q, List<String> degraded) {        if (vectorStore == null || embeddingProvider == null) return new ArrayList<>();
        try {
            // 确保 collection 存在
            if (!vectorStore.hasCollection(q.getWorkspace(), VECTOR_COLLECTION)) {
                return new ArrayList<>();
            }
            float[] vec = embeddingProvider.embed(q.getQuery());
            List<ChunkVectorStore.VectorMatch> matches = vectorStore.search(
                    q.getWorkspace(), VECTOR_COLLECTION, vec, q.getTopK() * 2, null);
            List<SearchHit> hits = new ArrayList<>();
            for (ChunkVectorStore.VectorMatch m : matches) {
                if (m.score < q.getMinScore()) continue;
                SearchHit hit = SearchHit.builder()
                        .chunkId(m.chunkId)
                        .documentId(m.documentId)
                        .score(m.score)
                        .source("vector")
                        .build();
                hits.add(hit);
            }
            return hits;
        } catch (Exception e) {
            // 不能只 warn 后返回空: 空结果会被下游当成「确实没召回到」，
            // 向量库故障会伪装成召回率下降。记进 stats 让调用方能区分两者。
            degraded.add("vector: " + e.getMessage());
            log.warn("Vector search failed: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<SearchHit> graphSearch(SearchQuery q, List<Entity> matchedEntities, List<String> degraded) {
        if (graphStore == null) return new ArrayList<>();
        try {
            // 必须先抽实体再逐个匹配：searchEntities 是 canonicalName.contains(keyword),
            // 直接把整句 query 当 keyword 传进去, 长句永远匹配不到任何实体名, 图谱路恒空。
            List<String> candidates = queryEntityNames(q.getQuery());
            if (candidates.isEmpty()) return new ArrayList<>();

            // 按 query 中出现的顺序去重, 并保持图谱召回的优先级顺序
            Map<String, Entity> found = new LinkedHashMap<>();
            for (String name : candidates) {
                for (Entity e : graphStore.searchEntities(q.getWorkspace(), name, 5)) {
                    found.putIfAbsent(e.getCanonicalName(), e);
                }
            }
            if (found.isEmpty()) return new ArrayList<>();

            matchedEntities.addAll(found.values());

            Map<String, SearchHit> hitMap = new LinkedHashMap<>();
            for (Entity e : found.values()) {
                if (e.getSourceChunkIds() == null) continue;
                for (String cid : e.getSourceChunkIds()) {
                    if (!hitMap.containsKey(cid)) {
                        SearchHit hit = SearchHit.builder()
                                .chunkId(cid)
                                .documentId(e.getSourceDocumentIds() != null && !e.getSourceDocumentIds().isEmpty()
                                        ? e.getSourceDocumentIds().get(0) : null)
                                .score(e.getImportance())
                                .source("graph")
                                .matchedEntities(new ArrayList<>(Collections.singletonList(e.getCanonicalName())))
                                .build();
                        hitMap.put(cid, hit);
                    }
                }
            }
            return new ArrayList<>(hitMap.values());
        } catch (Exception e) {
            degraded.add("graph: " + e.getMessage());
            log.warn("Graph search failed: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * 从 query 抽候选实体名 — 把 query 包成临时 Chunk 复用 {@link EntityExtractor}。
     *
     * <p>词典命中项（MySQL / Kubernetes 等）质量最高，高频词兜底可能掺噪声，
     * 但 searchEntities 本身是 contains 匹配，噪声只影响 limit 占用。
     */
    private List<String> queryEntityNames(String query) {
        if (query == null || query.trim().isEmpty() || entityExtractor == null) {
            return Collections.emptyList();
        }
        Chunk probe = new Chunk();
        probe.setWorkspace("");
        probe.setDocumentId("");
        probe.setContent(query);
        List<String> names = new ArrayList<>();
        for (Entity e : entityExtractor.extract(probe)) {
            if (e.getCanonicalName() != null && !e.getCanonicalName().trim().isEmpty()) {
                names.add(e.getCanonicalName().trim());
            }
        }
        return names;
    }

    /**
     * RRF 融合多条召回结果。
     */
    private List<SearchHit> rrfMerge(int k, List<WeightedHit>... lists) {
        Map<String, Double> scoreMap = new HashMap<>();
        Map<String, SearchHit> hitMap = new LinkedHashMap<>();

        for (List<WeightedHit> list : lists) {
            for (int rank = 0; rank < list.size(); rank++) {
                WeightedHit wh = list.get(rank);
                double rrfScore = wh.weight / (k + rank + 1);
                scoreMap.merge(wh.hit.getChunkId(), rrfScore, Double::sum);
                if (!hitMap.containsKey(wh.hit.getChunkId())) {
                    hitMap.put(wh.hit.getChunkId(), wh.hit);
                } else {
                    // 同一 chunk 被多路召回时，保留带正文的那份：向量路的 hit 从不携带正文
                    // （payload 里没存 content），而融合按列表顺序先到先得，向量路在前，
                    // 不做这一步则 FUSION/HYBRID 下大量命中正文为 null，RAG 会退化成空上下文问答。
                    SearchHit kept = hitMap.get(wh.hit.getChunkId());
                    if (kept.getContent() == null && wh.hit.getContent() != null) {
                        kept.setContent(wh.hit.getContent());
                        kept.setContextTitle(wh.hit.getContextTitle());
                        kept.setHeadingPath(wh.hit.getHeadingPath());
                    }
                }
                // 累加 sourceScores
                Map<String, Double> ss = hitMap.get(wh.hit.getChunkId()).getSourceScores();
                if (ss == null) ss = new HashMap<>();
                ss.merge(wh.hit.getSource(), rrfScore, Double::sum);
                hitMap.get(wh.hit.getChunkId()).setSourceScores(ss);
            }
        }
        List<SearchHit> result = new ArrayList<>();
        for (Map.Entry<String, Double> e : scoreMap.entrySet()) {
            SearchHit hit = hitMap.get(e.getKey());
            hit.setScore(e.getValue());
            hit.setSource("fusion");
            result.add(hit);
        }
        return result;
    }

    private List<WeightedHit> weightedList(List<SearchHit> hits, double weight) {
        List<WeightedHit> result = new ArrayList<>();
        for (SearchHit h : hits) {
            result.add(new WeightedHit(h, weight));
        }
        // 按 score 降序。无需归一化：RRF 只吃 rank 不吃 raw score，而 rank 由这一路的
        // 相对顺序决定，向量路(cosine ∈[0,1]) 与 BM25 路(无上界)量纲不同不影响。
        result.sort((a, b) -> Double.compare(b.hit.getScore(), a.hit.getScore()));
        return result;
    }

    private static class WeightedHit {
        final SearchHit hit;
        final double weight;
        WeightedHit(SearchHit hit, double weight) { this.hit = hit; this.weight = weight; }
    }
}
