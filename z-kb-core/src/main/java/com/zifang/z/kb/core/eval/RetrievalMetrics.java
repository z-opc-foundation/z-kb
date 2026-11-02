package com.zifang.z.kb.core.eval;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 检索侧指标计算器。
 *
 * <p>全部指标都只依赖「标注切片 id 是否出现在有序结果里」，因此是确定性的、可重复的，
 * 不需要 LLM 参与。这是 z-kb 效果论证的第一层证据。
 *
 * <p>指标定义（设第 i 条用例的相关切片集合为 R_i，前 K 条检索结果为 T_iK，N 为参与评分的用例数）：
 * <pre>
 *   HitRate@K  = (1/N) Σ 1[g_i ∈ T_iK]                     单条只有一个标注时等于命中率
 *   Recall@K   = (1/N) Σ |R_i ∩ T_iK| / |R_i|
 *   MRR        = (1/N) Σ 1 / firstRelevantRank_i           未命中记 0
 *   NDCG@K     = (1/N) Σ DCG@K_i / IDCG@K_i                二值相关性，无分级时 IDCG 取前 K 个满值
 * </pre>
 */
public final class RetrievalMetrics {

    private RetrievalMetrics() {
    }

    /** 单条用例的打分结果 */
    public static class CaseScore {
        public final String caseId;
        public final String question;
        public final boolean hit;
        public final double recall;
        public final double reciprocalRank;
        public final double ndcg;
        /** 首个相关切片在结果中的名次，从 1 起；未命中为 -1 */
        public final int firstHitRank;
        public final int expectedCount;
        public final List<String> retrievedChunkIds;

        CaseScore(String caseId, String question, boolean hit, double recall, double reciprocalRank,
                  double ndcg, int firstHitRank, int expectedCount, List<String> retrievedChunkIds) {
            this.caseId = caseId;
            this.question = question;
            this.hit = hit;
            this.recall = recall;
            this.reciprocalRank = reciprocalRank;
            this.ndcg = ndcg;
            this.firstHitRank = firstHitRank;
            this.expectedCount = expectedCount;
            this.retrievedChunkIds = retrievedChunkIds;
        }
    }

    /**
     * 对一条用例打分。
     *
     * @param retrievedChunkIds 有序的检索结果切片 id（已按最终排序）
     * @param k                  截断位置，指标只看前 K 条
     */
    public static CaseScore score(EvalCase c, List<String> retrievedChunkIds, int k) {
        List<String> truncated = new ArrayList<>();
        for (int i = 0; i < retrievedChunkIds.size() && i < k; i++) {
            truncated.add(retrievedChunkIds.get(i));
        }
        Set<String> expected = new LinkedHashSet<>(c.getExpectedChunkIds());

        int firstHitRank = -1;
        for (int i = 0; i < truncated.size(); i++) {
            if (expected.contains(truncated.get(i))) {
                firstHitRank = i + 1;
                break;
            }
        }

        int overlap = 0;
        for (String id : truncated) {
            if (expected.contains(id)) overlap++;
        }

        double recall = expected.isEmpty() ? 0 : (double) overlap / expected.size();
        double rr = firstHitRank > 0 ? 1.0 / firstHitRank : 0.0;
        double dcg = 0;
        for (int i = 0; i < truncated.size(); i++) {
            if (expected.contains(truncated.get(i))) {
                dcg += 1.0 / (Math.log(i + 2) / Math.log(2));
            }
        }
        int idealCount = Math.min(expected.size(), k);
        double idcg = 0;
        for (int i = 0; i < idealCount; i++) {
            idcg += 1.0 / (Math.log(i + 2) / Math.log(2));
        }
        double ndcg = idcg > 0 ? dcg / idcg : 0;

        return new CaseScore(c.getCaseId(), c.getQuestion(), firstHitRank > 0, recall, rr, ndcg,
                firstHitRank, expected.size(), truncated);
    }

    /** 聚合：只对 {@link EvalCase#isScoredForRetrieval()} 为 true 的用例求均值 */
    public static Aggregate aggregate(List<CaseScore> scores) {
        if (scores == null || scores.isEmpty()) {
            return new Aggregate(0, 0, 0, 0, 0);
        }
        double recall = 0, rr = 0, ndcg = 0;
        int hits = 0;
        for (CaseScore s : scores) {
            if (s.hit) hits++;
            recall += s.recall;
            rr += s.reciprocalRank;
            ndcg += s.ndcg;
        }
        int n = scores.size();
        return new Aggregate((double) hits / n, recall / n, rr / n, ndcg / n, n);
    }

    public static class Aggregate {
        public final double hitRate;
        public final double recall;
        public final double mrr;
        public final double ndcg;
        public final int sampleSize;

        Aggregate(double hitRate, double recall, double mrr, double ndcg, int sampleSize) {
            this.hitRate = hitRate;
            this.recall = recall;
            this.mrr = mrr;
            this.ndcg = ndcg;
            this.sampleSize = sampleSize;
        }
    }
}
