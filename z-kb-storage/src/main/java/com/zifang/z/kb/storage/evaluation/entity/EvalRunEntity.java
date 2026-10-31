package com.zifang.z.kb.storage.evaluation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 评测跑批（zkb_eval_run）。
 */
@TableName("zkb_eval_run")
public class EvalRunEntity {

    @TableId(type = IdType.INPUT)
    private String id;
    private String runId;
    private String tenantCode;
    private String kbId;
    private String datasetPk;
    private String datasetId;
    private Integer datasetVersionNo;
    private String snapshotId;
    private String configVersion;
    private String taskConfigVersion;
    private String judgeMode;
    private String judgeVersion;
    private String judgeConfig;
    private String retrievalConfig;
    private String indexGeneration;
    private String inputFingerprint;
    private String scopeType;
    private String stageCode;
    private String baselineRunId;
    private String status;
    private Integer resultUsable;
    private String unusableReason;
    private Integer caseTotal;
    private Integer caseDone;
    private Integer retrievalTruncated;
    private Instant startedAt;
    private Instant finishedAt;
    private Long durationMs;
    private String errorCode;
    private String errorMessage;
    private String triggeredBy;
    private String reusedFromRunId;
    private Integer isDeleted;
    private String createBy;
    private String updateBy;
    private Instant createTime;
    private Instant updateTime;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getTenantCode() {
        return tenantCode;
    }

    public void setTenantCode(String tenantCode) {
        this.tenantCode = tenantCode;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getDatasetPk() {
        return datasetPk;
    }

    public void setDatasetPk(String datasetPk) {
        this.datasetPk = datasetPk;
    }

    public String getDatasetId() {
        return datasetId;
    }

    public void setDatasetId(String datasetId) {
        this.datasetId = datasetId;
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

    public String getJudgeConfig() {
        return judgeConfig;
    }

    public void setJudgeConfig(String judgeConfig) {
        this.judgeConfig = judgeConfig;
    }

    public String getRetrievalConfig() {
        return retrievalConfig;
    }

    public void setRetrievalConfig(String retrievalConfig) {
        this.retrievalConfig = retrievalConfig;
    }

    public String getIndexGeneration() {
        return indexGeneration;
    }

    public void setIndexGeneration(String indexGeneration) {
        this.indexGeneration = indexGeneration;
    }

    public String getInputFingerprint() {
        return inputFingerprint;
    }

    public void setInputFingerprint(String inputFingerprint) {
        this.inputFingerprint = inputFingerprint;
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

    public String getBaselineRunId() {
        return baselineRunId;
    }

    public void setBaselineRunId(String baselineRunId) {
        this.baselineRunId = baselineRunId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getResultUsable() {
        return resultUsable;
    }

    public void setResultUsable(Integer resultUsable) {
        this.resultUsable = resultUsable;
    }

    public String getUnusableReason() {
        return unusableReason;
    }

    public void setUnusableReason(String unusableReason) {
        this.unusableReason = unusableReason;
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

    public Integer getRetrievalTruncated() {
        return retrievalTruncated;
    }

    public void setRetrievalTruncated(Integer retrievalTruncated) {
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

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getTriggeredBy() {
        return triggeredBy;
    }

    public void setTriggeredBy(String triggeredBy) {
        this.triggeredBy = triggeredBy;
    }

    public String getReusedFromRunId() {
        return reusedFromRunId;
    }

    public void setReusedFromRunId(String reusedFromRunId) {
        this.reusedFromRunId = reusedFromRunId;
    }

    public Integer getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Integer isDeleted) {
        this.isDeleted = isDeleted;
    }

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public String getUpdateBy() {
        return updateBy;
    }

    public void setUpdateBy(String updateBy) {
        this.updateBy = updateBy;
    }

    public Instant getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Instant createTime) {
        this.createTime = createTime;
    }

    public Instant getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Instant updateTime) {
        this.updateTime = updateTime;
    }
}
