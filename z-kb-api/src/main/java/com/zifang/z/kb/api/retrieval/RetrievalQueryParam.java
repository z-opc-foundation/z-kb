package com.zifang.z.kb.api.retrieval;

/**
 * 库内检索入参。范围固定当前库，模式当前只开放 dense。
 */
public class RetrievalQueryParam {

    private String kbId;
    private String query;
    private Integer topK;
    private Double minScore;
    private String mode;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public Double getMinScore() {
        return minScore;
    }

    public void setMinScore(Double minScore) {
        this.minScore = minScore;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }
}
