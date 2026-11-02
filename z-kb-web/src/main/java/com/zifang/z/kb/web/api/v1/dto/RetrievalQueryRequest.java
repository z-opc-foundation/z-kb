package com.zifang.z.kb.web.api.v1.dto;

import com.zifang.z.kb.api.retrieval.RetrievalQueryParam;

/**
 * 库内检索请求。mode 当前只支持 dense。
 */
public class RetrievalQueryRequest {

    private String kbId;
    private String query;
    private Integer topK;
    private Double minScore;
    private String mode;

    public RetrievalQueryParam toParam() {
        RetrievalQueryParam param = new RetrievalQueryParam();
        param.setKbId(kbId);
        param.setQuery(query);
        param.setTopK(topK);
        param.setMinScore(minScore);
        param.setMode(mode);
        return param;
    }

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
