package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 阶段诊断：阶段状态与所属指标。
 */
public class EvaluationStageInfo {

    private String stageCode;
    private String stageName;
    private String status;
    private List<EvaluationMetricInfo> metrics = new ArrayList<>();
    private int failingCaseCount;

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }

    public String getStageName() {
        return stageName;
    }

    public void setStageName(String stageName) {
        this.stageName = stageName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<EvaluationMetricInfo> getMetrics() {
        return metrics;
    }

    public void setMetrics(List<EvaluationMetricInfo> metrics) {
        this.metrics = metrics;
    }

    public int getFailingCaseCount() {
        return failingCaseCount;
    }

    public void setFailingCaseCount(int failingCaseCount) {
        this.failingCaseCount = failingCaseCount;
    }
}
