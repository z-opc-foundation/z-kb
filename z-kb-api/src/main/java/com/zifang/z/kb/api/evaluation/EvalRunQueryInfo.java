package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 跑批详情：运行、四层指标、阶段诊断、坏例统计、可信证据与基线对比。
 */
public class EvalRunQueryInfo {

    private RunDetailInfo run;
    private List<EvaluationMetricInfo> metrics = new ArrayList<>();
    private List<EvaluationStageInfo> stages = new ArrayList<>();
    private BadcaseCountInfo badcaseCounts = new BadcaseCountInfo();
    private List<TrustEvidenceInfo> evidence = new ArrayList<>();
    private BaselineMetricsInfo baseline;
    private boolean comparable;

    public RunDetailInfo getRun() {
        return run;
    }

    public void setRun(RunDetailInfo run) {
        this.run = run;
    }

    public List<EvaluationMetricInfo> getMetrics() {
        return metrics;
    }

    public void setMetrics(List<EvaluationMetricInfo> metrics) {
        this.metrics = metrics;
    }

    public List<EvaluationStageInfo> getStages() {
        return stages;
    }

    public void setStages(List<EvaluationStageInfo> stages) {
        this.stages = stages;
    }

    public BadcaseCountInfo getBadcaseCounts() {
        return badcaseCounts;
    }

    public void setBadcaseCounts(BadcaseCountInfo badcaseCounts) {
        this.badcaseCounts = badcaseCounts;
    }

    public List<TrustEvidenceInfo> getEvidence() {
        return evidence;
    }

    public void setEvidence(List<TrustEvidenceInfo> evidence) {
        this.evidence = evidence;
    }

    public BaselineMetricsInfo getBaseline() {
        return baseline;
    }

    public void setBaseline(BaselineMetricsInfo baseline) {
        this.baseline = baseline;
    }

    public boolean isComparable() {
        return comparable;
    }

    public void setComparable(boolean comparable) {
        this.comparable = comparable;
    }
}
