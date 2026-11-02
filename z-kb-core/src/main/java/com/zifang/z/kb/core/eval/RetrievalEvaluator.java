package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 检索评测执行器 — 用一份黄金集跑一个检索模式，产出可归档的报告。
 *
 * <p>消融实验的用法：同一份 {@link EvalDataset}、同一个 {@code k}，只改 {@code mode}
 * 分别跑 VECTOR / KEYWORD / HYBRID / FUSION，得到的效果差异才能归因到检索策略本身。
 */
public class RetrievalEvaluator {

    private final SearchService searchService;
    private final String embeddingProviderName;

    public RetrievalEvaluator(SearchService searchService, String embeddingProviderName) {
        this.searchService = searchService;
        this.embeddingProviderName = embeddingProviderName;
    }

    public RetrievalEvalReport evaluate(EvalDataset dataset, SearchMode mode, String workspace, int topK, int k) {
        RetrievalEvalReport report = new RetrievalEvalReport();
        report.setDatasetVersion(dataset.getDatasetVersion());
        report.setKnowledgeVersion(dataset.getKnowledgeVersion());
        report.setMode(mode.name());
        report.setEmbeddingProvider(embeddingProviderName);
        report.setTopK(topK);
        report.setK(k);

        List<RetrievalMetrics.CaseScore> all = new ArrayList<>();
        Map<String, List<RetrievalMetrics.CaseScore>> topicGroups = new LinkedHashMap<>();
        Map<String, List<RetrievalMetrics.CaseScore>> difficultyGroups = new LinkedHashMap<>();
        Map<String, List<RetrievalMetrics.CaseScore>> sourceGroups = new LinkedHashMap<>();
        Map<String, Integer> routeTotals = new LinkedHashMap<>();
        int emptyCases = 0;

        for (EvalCase c : dataset.getCases()) {
            if (!c.isScoredForRetrieval()) {
                continue;
            }

            SearchQuery q = new SearchQuery();
            q.setQuery(c.getQuestion());
            q.setWorkspace(workspace);
            q.setMode(mode);
            q.setTopK(topK);

            SearchResult result;
            try {
                result = searchService.search(q);
            } catch (RuntimeException e) {
                // 依赖故障必须显式暴露：吞掉会让「检索不到」和「服务挂了」混成同一个空结果
                throw new IllegalStateException("检索失败于用例 " + c.getCaseId() + ": " + e.getMessage(), e);
            }

            List<String> retrievedIds = new ArrayList<>();
            if (result != null && result.getHits() != null) {
                for (SearchHit h : result.getHits()) {
                    if (h.getChunkId() != null) {
                        retrievedIds.add(h.getChunkId());
                    }
                }
                for (Map.Entry<String, Integer> e : result.getStats().entrySet()) {
                    routeTotals.merge(e.getKey(), e.getValue(), Integer::sum);
                }
            }
            if (retrievedIds.isEmpty()) {
                emptyCases++;
            }

            RetrievalMetrics.CaseScore score = RetrievalMetrics.score(c, retrievedIds, k);
            all.add(score);
            group(topicGroups, c.getTopic(), score);
            group(difficultyGroups, c.getDifficulty(), score);
            group(sourceGroups, c.getSourceType(), score);
        }

        report.setCases(all);
        report.setOverall(RetrievalMetrics.aggregate(all));
        report.setByTopic(aggregateGroups(topicGroups));
        report.setByDifficulty(aggregateGroups(difficultyGroups));
        report.setBySourceType(aggregateGroups(sourceGroups));
        report.setRouteHitCounts(routeTotals);
        report.setEmptyResultCases(emptyCases);
        return report;
    }

    private static void group(Map<String, List<RetrievalMetrics.CaseScore>> target, String key,
                              RetrievalMetrics.CaseScore score) {
        String k = (key == null || key.isEmpty()) ? "unknown" : key;
        target.computeIfAbsent(k, x -> new ArrayList<>()).add(score);
    }

    private static Map<String, RetrievalMetrics.Aggregate> aggregateGroups(
            Map<String, List<RetrievalMetrics.CaseScore>> groups) {
        Map<String, RetrievalMetrics.Aggregate> out = new LinkedHashMap<>();
        for (Map.Entry<String, List<RetrievalMetrics.CaseScore>> e : groups.entrySet()) {
            out.put(e.getKey(), RetrievalMetrics.aggregate(e.getValue()));
        }
        return out;
    }
}
