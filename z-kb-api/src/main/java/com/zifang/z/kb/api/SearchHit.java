package com.zifang.z.kb.api;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 单条检索命中。
 */
public class SearchHit {

    private String chunkId;
    private String documentId;
    private String documentTitle;
    private String content;
    private String contextTitle;
    private List<String> headingPath;
    private double score;
    private String source;            // "vector" / "keyword" / "graph" / "fusion"
    private Map<String, Double> sourceScores = new LinkedHashMap<>(); // 每路召回的得分
    private List<String> matchedKeywords;
    private List<String> matchedEntities;
    private int ordinal;

    public String getChunkId() { return chunkId; }
    public void setChunkId(String chunkId) { this.chunkId = chunkId; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getContextTitle() { return contextTitle; }
    public void setContextTitle(String contextTitle) { this.contextTitle = contextTitle; }
    public List<String> getHeadingPath() { return headingPath; }
    public void setHeadingPath(List<String> headingPath) { this.headingPath = headingPath; }
    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Map<String, Double> getSourceScores() { return sourceScores; }
    public void setSourceScores(Map<String, Double> sourceScores) { this.sourceScores = sourceScores; }
    public List<String> getMatchedKeywords() { return matchedKeywords; }
    public void setMatchedKeywords(List<String> matchedKeywords) { this.matchedKeywords = matchedKeywords; }
    public List<String> getMatchedEntities() { return matchedEntities; }
    public void setMatchedEntities(List<String> matchedEntities) { this.matchedEntities = matchedEntities; }
    public int getOrdinal() { return ordinal; }
    public void setOrdinal(int ordinal) { this.ordinal = ordinal; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final SearchHit h = new SearchHit();
        public Builder chunkId(String v) { h.chunkId = v; return this; }
        public Builder documentId(String v) { h.documentId = v; return this; }
        public Builder documentTitle(String v) { h.documentTitle = v; return this; }
        public Builder content(String v) { h.content = v; return this; }
        public Builder contextTitle(String v) { h.contextTitle = v; return this; }
        public Builder headingPath(List<String> v) { h.headingPath = v; return this; }
        public Builder score(double v) { h.score = v; return this; }
        public Builder source(String v) { h.source = v; return this; }
        public Builder sourceScores(Map<String, Double> v) { h.sourceScores = v; return this; }
        public Builder matchedKeywords(List<String> v) { h.matchedKeywords = v; return this; }
        public Builder matchedEntities(List<String> v) { h.matchedEntities = v; return this; }
        public Builder ordinal(int v) { h.ordinal = v; return this; }
        public SearchHit build() { return h; }
    }
}
