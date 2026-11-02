package com.zifang.z.kb.core.retrieval;

import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher.Candidate;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher.GraphHit;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher.Hit;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher.Mode;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 三路 RRF 融合引擎的确定性单测。
 *
 * <p>覆盖：各路独立召回、RRF 排序（多路命中优于单路）、命中词/命中概念并集、
 * 模式隔离、降级路径、边界（空查询 / 空候选 / topK 截断）。</p>
 */
class HybridLibrarySearcherTest {

    private final HybridLibrarySearcher searcher = new HybridLibrarySearcher();

    private Candidate candidate(String chunkId, String content) {
        return new Candidate(chunkId, "m-1", content, "章节", searcher.embedding().embed(content));
    }

    @Test
    @DisplayName("模式解析：空值落 fusion，未知值返回 null")
    void modeParsing() {
        assertEquals(Mode.FUSION, Mode.parse(null));
        assertEquals(Mode.FUSION, Mode.parse("   "));
        assertEquals(Mode.FUSION, Mode.parse("fusion"));
        assertEquals(Mode.DENSE, Mode.parse("DENSE"));
        assertEquals(Mode.BM25, Mode.parse(" bm25 "));
        assertEquals(Mode.HYBRID, Mode.parse("Hybrid"));
        assertNull(Mode.parse("magic"));
    }

    @Test
    @DisplayName("BM25 路：词面命中，正文不含查询词时也能召回")
    void bm25RouteFindsLexicalMatch() {
        List<Candidate> candidates = Arrays.asList(
                candidate("c-1", "Elasticsearch 负责全文检索与倒排索引。"),
                candidate("c-2", "Qdrant 负责向量召回与近似最近邻搜索。"));

        Result result = searcher.search(Mode.BM25, "倒排索引", candidates,
                Collections.emptyList(), 5, 0.0d, null);

        assertFalse(result.getHits().isEmpty(), "BM25 应召回含「倒排索引」的块");
        assertEquals("c-1", result.getHits().get(0).getChunkId());
        assertEquals(0, result.getRouteCounts().get("vector").intValue());
        assertTrue(result.getRouteCounts().get("keyword") > 0);
    }

    @Test
    @DisplayName("向量路：语义相近的块排在前面")
    void denseRouteRanksByCosine() {
        List<Candidate> candidates = Arrays.asList(
                candidate("c-1", "检索是怎么做的"),
                candidate("c-2", "今天天气不错适合散步"));

        Result result = searcher.search(Mode.DENSE, "检索是怎么做的", candidates,
                Collections.emptyList(), 5, 0.0d, null);

        assertFalse(result.getHits().isEmpty());
        assertEquals("c-1", result.getHits().get(0).getChunkId());
        assertTrue(result.getRouteCounts().get("vector") > 0);
        assertEquals(0, result.getRouteCounts().get("keyword").intValue());
    }

    @Test
    @DisplayName("图谱路：只有图谱关联的块也能被召回")
    void graphRouteFindsConceptLinkedChunk() {
        List<Candidate> candidates = Arrays.asList(
                candidate("c-1", "完全无关的正文内容，用于验证图谱路召回。"),
                candidate("c-2", "另一段正文。"));
        List<GraphHit> graphHits = Arrays.asList(new GraphHit("c-1", "接入源", 3));

        Result result = searcher.search(Mode.FUSION, "接入源", candidates,
                graphHits, 5, 0.0d, null);

        assertFalse(result.getHits().isEmpty(), "图谱路应召回概念关联的块");
        assertEquals("c-1", result.getHits().get(0).getChunkId());
        assertTrue(result.getRouteCounts().get("graph") > 0);
        assertTrue(result.getHits().get(0).getMatchedEntities().contains("接入源"),
                "命中概念应被记录");
    }

    @Test
    @DisplayName("RRF 融合：多路同时命中的块排在单路命中之前")
    void rrfPrefersMultiRouteHits() {
        // c-1 向量与词面都沾边；c-2 只有词面沾边。
        List<Candidate> candidates = Arrays.asList(
                candidate("c-1", "Elasticsearch 全文检索与向量召回的结合"),
                candidate("c-2", "纯粹的 Elasticsearch 全文检索介绍"));
        List<GraphHit> graphHits = Collections.singletonList(new GraphHit("c-1", "检索", 2));

        Result result = searcher.search(Mode.FUSION, "Elasticsearch 检索", candidates,
                graphHits, 5, 0.0d, null);

        assertTrue(result.getHits().size() >= 2);
        assertEquals("c-1", result.getHits().get(0).getChunkId(),
                "三路都命中的块应排第一");
        Hit top = result.getHits().get(0);
        assertEquals(1, top.getRank());
        assertTrue(top.getScore() > result.getHits().get(1).getScore());
        assertNotNull(top.getSourceScores());
        assertTrue(top.getSourceScores().size() >= 2, "应记录各路得分分解");
    }

    @Test
    @DisplayName("命中词与命中概念取并集（两路合并后不能丢信息）")
    void matchedTermsAndEntitiesAreUnioned() {
        List<Candidate> candidates = Arrays.asList(
                candidate("c-1", "接入源支持本地目录与语雀两种形态"));
        List<GraphHit> graphHits = Collections.singletonList(new GraphHit("c-1", "接入源", 1));

        Result result = searcher.search(Mode.FUSION, "本地目录", candidates,
                graphHits, 5, 0.0d, null);

        assertFalse(result.getHits().isEmpty());
        Hit hit = result.getHits().get(0);
        assertFalse(hit.getMatchedTerms().isEmpty(), "词面路命中词不应为空");
        assertTrue(hit.getMatchedEntities().contains("接入源"),
                "图谱路命中概念不应被丢掉");
    }

    @Test
    @DisplayName("模式隔离：bm25 不跑向量路，dense 不跑关键词路")
    void modesAreIsolated() {
        List<Candidate> candidates = Arrays.asList(candidate("c-1", "接入源"));

        Result bm25 = searcher.search(Mode.BM25, "接入源", candidates,
                Collections.emptyList(), 5, 0.0d, null);
        assertEquals(0, bm25.getRouteCounts().get("vector").intValue());
        assertEquals(0, bm25.getRouteCounts().get("graph").intValue());

        Result hybrid = searcher.search(Mode.HYBRID, "接入源", candidates,
                Collections.emptyList(), 5, 0.0d, null);
        assertEquals(0, hybrid.getRouteCounts().get("graph").intValue(),
                "hybrid 不含图谱路");
        assertTrue(hybrid.getRouteCounts().get("vector") > 0);
        assertTrue(hybrid.getRouteCounts().get("keyword") > 0);
    }

    @Test
    @DisplayName("降级：图谱路无输入时 fusion 仍能返回向量与词面结果")
    void fusionDegradesWhenGraphMissing() {
        List<Candidate> candidates = Arrays.asList(candidate("c-1", "接入源"));

        Result result = searcher.search(Mode.FUSION, "接入源", candidates,
                Collections.emptyList(), 5, 0.0d, null);

        assertFalse(result.getHits().isEmpty());
        assertEquals(0, result.getRouteCounts().get("graph").intValue());
        // 图谱路「没有关联」是库的正常状态（库内可能没抽概念），不是故障，
        // 因此不得记入降级列表 —— 降级只用于真正的异常（catch 分支）。
        assertTrue(result.getDegradedRoutes().isEmpty(),
                "图谱路无输入属正常态，不应记为降级；实际=" + result.getDegradedRoutes());
        assertTrue(result.getRouteCounts().get("vector") > 0);
        assertTrue(result.getRouteCounts().get("keyword") > 0);
    }

    @Test
    @DisplayName("边界：空查询 / 空候选返回空结果且不抛异常")
    void handlesEmptyInput() {
        Result emptyQuery = searcher.search(Mode.FUSION, "  ", Arrays.asList(
                candidate("c-1", "内容")), Collections.emptyList(), 5, 0.0d, null);
        assertTrue(emptyQuery.getHits().isEmpty());

        Result emptyCandidates = searcher.search(Mode.FUSION, "接入源",
                new ArrayList<>(), Collections.emptyList(), 5, 0.0d, null);
        assertTrue(emptyCandidates.getHits().isEmpty());
        assertEquals(0, emptyCandidates.getRouteCounts().get("vector").intValue());
    }

    @Test
    @DisplayName("topK 截断：返回条数不超过 topK，rank 从 1 连续递增")
    void topKTruncatesAndRanksContinuously() {
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            candidates.add(candidate("c-" + i, "接入源 章节 " + i + " 内容说明。"));
        }

        Result result = searcher.search(Mode.FUSION, "接入源", candidates,
                Collections.emptyList(), 3, 0.0d, null);

        assertEquals(3, result.getHits().size());
        for (int i = 0; i < result.getHits().size(); i++) {
            assertEquals(i + 1, result.getHits().get(i).getRank());
        }
    }
}
