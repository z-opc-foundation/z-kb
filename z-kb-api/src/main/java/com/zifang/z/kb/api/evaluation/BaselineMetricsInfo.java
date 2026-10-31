package com.zifang.z.kb.api.evaluation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 基线跑批的指标明细。
 */
public class BaselineMetricsInfo {

    private String runId;
    private Instant finishedAt;
    private List<EvaluationMetricInfo> metrics = new ArrayList<>();

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public List<EvaluationMetricInfo> getMetrics() {
        return metrics;
    }

    public void setMetrics(List<EvaluationMetricInfo> metrics) {
        this.metrics = metrics;
    }
}
