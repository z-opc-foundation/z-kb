package com.zifang.z.kb.core.search;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
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

    /** 向量 Collection 名（所有 workspace 共用一个） */
    private static final String VECTOR_COLLECTION = "kb_chunks";

    public HybridSearcher(ChunkVectorStore vectorStore,
                           KnowledgeGraphStore graphStore,
                           Bm25Searcher bm25Searcher,
                           EmbeddingProvider embeddingProvider,
                           EntityExtractor entityExtractor) {
        this.vectorStore = vectorStore;
        this.graphStore = graphStore;
        this.bm25Searcher = bm25Searcher;
        this.embeddingProvider = embeddingProvider;
        this.entityExtractor = entityExtractor;
    }

    public SearchResult search(SearchQuery q) {
        long start = System.currentTimeMillis();
        SearchResult result = new SearchResult();
        result.setQuery(q.getQuery());
        result.setMode(q.getMode());

        // 1. 向量召回
        List<SearchHit> vectorHits = new ArrayList<>();
        if (q.getMode() == SearchMode.VECTOR || q.getMode() == SearchMode.HYBRID || q.getMode() == SearchMode.FUSION) {
            vectorHits = vectorSearch(q);
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
            graphHits = graphSearch(q, matchedEntities);
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

        result.setHits(merged);
        result.setTotalHits(merged.size());
        result.setMatchedEntities(matchedEntities);
        result.getStats().put("vector", vectorHits.size());
        result.getStats().put("keyword", keywordHits.size());
        result.getStats().put("graph", graphHits.size());
        result.setElapsedMillis(System.currentTimeMillis() - start);
        return result;
    }

    private List<SearchHit> vectorSearch(SearchQuery q) {
        if (vectorStore == null || embeddingProvider == null) return new ArrayList<>();
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
            log.warn("Vector search failed: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<SearchHit> graphSearch(SearchQuery q, List<Entity> matchedEntities) {
        if (graphStore == null) return new ArrayList<>();
        try {
            // 从查询中抽取候选实体
            List<Entity> entities = graphStore.searchEntities(q.getWorkspace(), q.getQuery(), 5);
            if (entities.isEmpty()) return new ArrayList<>();

            matchedEntities.addAll(entities);

            // 取这些实体的 2 跳邻居 chunk
            Map<String, SearchHit> hitMap = new LinkedHashMap<>();
            for (Entity e : entities) {
                // 找该实体作为 source/target 的关系所关联的 chunk
                // 这里简化为：返回这些实体的 sourceChunkIds 对应的命中
                if (e.getSourceChunkIds() != null) {
                    for (String cid : e.getSourceChunkIds()) {
                        if (!hitMap.containsKey(cid)) {
                            SearchHit hit = SearchHit.builder()
                                    .chunkId(cid)
                                    .documentId(e.getSourceDocumentIds() != null && !e.getSourceDocumentIds().isEmpty()
                                            ? e.getSourceDocumentIds().get(0) : null)
                                    .score(e.getImportance())
                                    .source("graph")
                                    .matchedEntities(new ArrayList<>(List.of(e.getCanonicalName())))
                                    .build();
                            hitMap.put(cid, hit);
                        }
                    }
                }
            }
            return new ArrayList<>(hitMap.values());
        } catch (Exception e) {
            log.warn("Graph search failed: {}", e.getMessage());
            return new ArrayList<>();
        }
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
            // 对原始 score 做归一化（min-max）
            result.add(new WeightedHit(h, weight));
        }
        // 按 score 降序
        result.sort((a, b) -> Double.compare(b.hit.getScore(), a.hit.getScore()));
        return result;
    }

    private static class WeightedHit {
        final SearchHit hit;
        final double weight;
        WeightedHit(SearchHit hit, double weight) { this.hit = hit; this.weight = weight; }
    }
}
