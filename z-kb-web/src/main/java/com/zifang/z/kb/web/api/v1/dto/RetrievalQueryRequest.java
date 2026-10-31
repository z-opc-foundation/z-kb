package com.zifang.z.***REMOVED***.web.api.v1.dto;

import com.zifang.z.***REMOVED***.api.retrieval.RetrievalQueryParam;

/**
 * 库内检索请求。mode 当前只支持 dense。
 */
public class RetrievalQueryRequest {

    private String ***REMOVED***Id;
    private String query;
    private Integer topK;
    private Double minScore;
    private String mode;

    public RetrievalQueryParam toParam() {
        RetrievalQueryParam param = new RetrievalQueryParam();
        param.set***REMOVED***Id(***REMOVED***Id);
        param.setQuery(query);
        param.setTopK(topK);
        param.setMinScore(minScore);
        param.setMode(mode);
        return param;
    }

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
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
