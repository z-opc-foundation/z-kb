package com.zifang.z.kb.api.evaluation;

import java.time.Instant;

/**
 * 跑批详情基础信息。
 */
public class RunDetailInfo {

    private String runId;
    private String kbId;
    private String status;
    private Boolean resultUsable;
    private String unusableReason;
    private Integer datasetVersionNo;
    private String snapshotId;
    private String configVersion;
    private String taskConfigVersion;
    private String judgeMode;
    private String judgeVersion;
    private String indexGeneration;
    private String scopeType;
    private String stageCode;
    private Integer caseTotal;
    private Integer caseDone;
    private Boolean retrievalTruncated;
    private Instant startedAt;
    private Instant finishedAt;
    private Long durationMs;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
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

    public String getTaskConfigVersion() {
        return taskConfigVersion;
    }

    public void setTaskConfigVersion(String taskConfigVersion) {
        this.taskConfigVersion = taskConfigVersion;
    }

    public String getJudgeMode() {
        return judgeMode;
    }

    public void setJudgeMode(String judgeMode) {
        this.judgeMode = judgeMode;
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

    public Boolean getRetrievalTruncated() {
        return retrievalTruncated;
    }

    public void setRetrievalTruncated(Boolean retrievalTruncated) {
        this.retrievalTruncated = retrievalTruncated;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
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
}
