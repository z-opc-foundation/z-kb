package com.zifang.z.kb.api.evaluation;

/**
 * 逐题结果分页参数。
 */
public class EvalCaseResultPageParam {

    private String runId;
    private Integer current = 1;
    private Integer size = 20;
    private Boolean onlyBad = Boolean.FALSE;
    private String stageCode;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public Integer getCurrent() {
        return current;
    }

    public void setCurrent(Integer current) {
        this.current = current;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public Boolean getOnlyBad() {
        return onlyBad;
    }

    public void setOnlyBad(Boolean onlyBad) {
        this.onlyBad = onlyBad;
    }

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }
}
