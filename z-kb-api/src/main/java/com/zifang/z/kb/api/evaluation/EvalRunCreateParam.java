package com.zifang.z.kb.api.evaluation;

/**
 * 跑批创建参数。
 */
public class EvalRunCreateParam {

    private String kbId;
    private Integer datasetVersionNo;
    private String baselineRunId;
    private Boolean allowReuse = Boolean.TRUE;
    private String scopeType;
    private String stageCode;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public Integer getDatasetVersionNo() {
        return datasetVersionNo;
    }

    public void setDatasetVersionNo(Integer datasetVersionNo) {
        this.datasetVersionNo = datasetVersionNo;
    }

    public String getBaselineRunId() {
        return baselineRunId;
    }

    public void setBaselineRunId(String baselineRunId) {
        this.baselineRunId = baselineRunId;
    }

    public Boolean getAllowReuse() {
        return allowReuse;
    }

    public void setAllowReuse(Boolean allowReuse) {
        this.allowReuse = allowReuse;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }
}
