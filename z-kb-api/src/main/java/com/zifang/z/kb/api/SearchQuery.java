package com.zifang.z.kb.api;

import java.util.ArrayList;
import java.util.List;

/**
 * 检索请求 — 统一的搜索参数入口。
 */
public class SearchQuery {

    private String query;
    private String workspace = "default";
    private int topK = 10;
    private SearchMode mode = SearchMode.FUSION;
    /** 向量召回权重（HYBRID/FUSION 时生效） */
    private double vectorWeight = 0.5;
    /** 关键词召回权重 */
    private double keywordWeight = 0.3;
    /** 图谱召回权重 */
    private double graphWeight = 0.2;
    /** 标签过滤（空表示不过滤） */
    private List<String> tags = new ArrayList<>();
    /** 文档 ID 过滤 */
    private List<String> documentIds = new ArrayList<>();
    /** 是否包含原文 */
    private boolean includeContent = true;
    /** RRF 的 k 参数 */
    private int rrfK = 60;
    /** 最小相似度阈值（向量召回过滤） */
    private double minScore = 0.0;

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public int getTopK() { return topK; }
    public void setTopK(int topK) { this.topK = topK; }
    public SearchMode getMode() { return mode; }
    public void setMode(SearchMode mode) { this.mode = mode; }
    public double getVectorWeight() { return vectorWeight; }
    public void setVectorWeight(double vectorWeight) { this.vectorWeight = vectorWeight; }
    public double getKeywordWeight() { return keywordWeight; }
    public void setKeywordWeight(double keywordWeight) { this.keywordWeight = keywordWeight; }
    public double getGraphWeight() { return graphWeight; }
    public void setGraphWeight(double graphWeight) { this.graphWeight = graphWeight; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public List<String> getDocumentIds() { return documentIds; }
    public void setDocumentIds(List<String> documentIds) { this.documentIds = documentIds; }
    public boolean isIncludeContent() { return includeContent; }
    public void setIncludeContent(boolean includeContent) { this.includeContent = includeContent; }
    public int getRrfK() { return rrfK; }
    public void setRrfK(int rrfK) { this.rrfK = rrfK; }
    public double getMinScore() { return minScore; }
    public void setMinScore(double minScore) { this.minScore = minScore; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final SearchQuery q = new SearchQuery();
        public Builder query(String v) { q.query = v; return this; }
        public Builder workspace(String v) { q.workspace = v; return this; }
        public Builder topK(int v) { q.topK = v; return this; }
        public Builder mode(SearchMode v) { q.mode = v; return this; }
        public Builder vectorWeight(double v) { q.vectorWeight = v; return this; }
        public Builder keywordWeight(double v) { q.keywordWeight = v; return this; }
        public Builder graphWeight(double v) { q.graphWeight = v; return this; }
        public Builder tags(List<String> v) { q.tags = v; return this; }
        public Builder documentIds(List<String> v) { q.documentIds = v; return this; }
        public Builder includeContent(boolean v) { q.includeContent = v; return this; }
        public Builder rrfK(int v) { q.rrfK = v; return this; }
        public Builder minScore(double v) { q.minScore = v; return this; }
        public SearchQuery build() { return q; }
    }
}
