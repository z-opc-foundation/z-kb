package com.zifang.z.kb.core.eval;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 一次检索评测的完整报告。
 *
 * <p>同时保留逐条明细与聚合值：只报均值会掩盖「大部分用例满分 + 少数全错」这类问题，
 * 而全错的那几条往往正是需要改分块或改 embedding 的地方。
 */
public class RetrievalEvalReport {

    private String datasetVersion;
    private String knowledgeVersion;
    private String mode;
    private String embeddingProvider;
    private int topK;
    private int k;

    private List<RetrievalMetrics.CaseScore> cases = new ArrayList<>();
    private RetrievalMetrics.Aggregate overall;
    private Map<String, RetrievalMetrics.Aggregate> byTopic = new LinkedHashMap<>();
    private Map<String, RetrievalMetrics.Aggregate> byDifficulty = new LinkedHashMap<>();
    private Map<String, RetrievalMetrics.Aggregate> bySourceType = new LinkedHashMap<>();

    /** 三路召回各贡献多少条（来自 SearchResult.stats），用于定位「哪一路在拖后腿」 */
    private Map<String, Integer> routeHitCounts = new LinkedHashMap<>();
    /** 空结果用例数 —— 需与「依赖异常导致降级」区分，不能混为一谈 */
    private int emptyResultCases;

    public String getDatasetVersion() { return datasetVersion; }
    public void setDatasetVersion(String v) { this.datasetVersion = v; }

    public String getKnowledgeVersion() { return knowledgeVersion; }
    public void setKnowledgeVersion(String v) { this.knowledgeVersion = v; }

    public String getMode() { return mode; }
    public void setMode(String v) { this.mode = v; }

    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String v) { this.embeddingProvider = v; }

    public int getTopK() { return topK; }
    public void setTopK(int v) { this.topK = v; }

    public int getK() { return k; }
    public void setK(int v) { this.k = v; }

    public List<RetrievalMetrics.CaseScore> getCases() { return cases; }
    public void setCases(List<RetrievalMetrics.CaseScore> v) { this.cases = v; }

    public RetrievalMetrics.Aggregate getOverall() { return overall; }
    public void setOverall(RetrievalMetrics.Aggregate v) { this.overall = v; }

    public Map<String, RetrievalMetrics.Aggregate> getByTopic() { return byTopic; }
    public void setByTopic(Map<String, RetrievalMetrics.Aggregate> v) { this.byTopic = v; }

    public Map<String, RetrievalMetrics.Aggregate> getByDifficulty() { return byDifficulty; }
    public void setByDifficulty(Map<String, RetrievalMetrics.Aggregate> v) { this.byDifficulty = v; }

    public Map<String, RetrievalMetrics.Aggregate> getBySourceType() { return bySourceType; }
    public void setBySourceType(Map<String, RetrievalMetrics.Aggregate> v) { this.bySourceType = v; }

    public Map<String, Integer> getRouteHitCounts() { return routeHitCounts; }
    public void setRouteHitCounts(Map<String, Integer> v) { this.routeHitCounts = v; }

    public int getEmptyResultCases() { return emptyResultCases; }
    public void setEmptyResultCases(int v) { this.emptyResultCases = v; }
}
