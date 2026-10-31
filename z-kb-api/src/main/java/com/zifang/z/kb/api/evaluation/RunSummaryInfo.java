package com.zifang.z.kb.api.evaluation;

import java.time.Instant;

/**
 * 跑批创建返回摘要。
 */
public class RunSummaryInfo {

    private String runId;
    private String status;
    private Boolean resultUsable;
    private String unusableReason;
    private Integer datasetVersionNo;
    private String snapshotId;
    private String configVersion;
    private String judgeVersion;
    private String indexGeneration;
    private Integer caseTotal;
    private Integer caseDone;
    private Instant finishedAt;
    private Long durationMs;
    private boolean reused;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Boolean getResultUsable() {
        return resultUsable;
    }

    public void setResultUsable(Boolean resultUsable) {
        this.resultUsable = resultUsable;
    }

    public String getUnusableReason() {
        return unusableReason;
    }

    public void setUnusableReason(String unusableReason) {
        this.unusableReason = unusableReason;
    }

    public Integer getDatasetVersionNo() {
        return datasetVersionNo;
    }

    public void setDatasetVersionNo(Integer datasetVersionNo) {
        this.datasetVersionNo = datasetVersionNo;
    }

    public String getSnapshotId() {
        return snapshotId;
    }

    public void setSnapshotId(String snapshotId) {
        this.snapshotId = snapshotId;
    }

    public String getConfigVersion() {
        return configVersion;
    }

    public void setConfigVersion(String configVersion) {
        this.configVersion = configVersion;
    }

    public String getJudgeVersion() {
        return judgeVersion;
    }

    public void setJudgeVersion(String judgeVersion) {
        this.judgeVersion = judgeVersion;
    }

    public String getIndexGeneration() {
        return indexGeneration;
    }

    public void setIndexGeneration(String indexGeneration) {
        this.indexGeneration = indexGeneration;
    }

    public Integer getCaseTotal() {
        return caseTotal;
    }

    public void setCaseTotal(Integer caseTotal) {
        this.caseTotal = caseTotal;
    }

    public Integer getCaseDone() {
        return caseDone;
    }

    public void setCaseDone(Integer caseDone) {
        this.caseDone = caseDone;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public boolean isReused() {
        return reused;
    }

    public void setReused(boolean reused) {
        this.reused = reused;
    }
}
