package com.zifang.z.kb.api.compilation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 编译作业详情。阶段按首条输入物料版本投影，产物取登记簿当前版本。
 */
public class CompilationJobView {

    private String jobId;
    private String kbId;
    private String name;
    private String taskType;
    private String scopeType;
    private String scopeId;
    private Integer scopeCount;
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private String materialId;
    private String materialVersionId;
    private String pipelineType;
    private String configVersion;
    private String configSnapshot;
    private String compilerVersion;
    private String runStatus;
    private String milestone;
    private String currentStage;
    private Integer chunkCount;
    private Instant m1At;
    private Instant m2At;
    private Instant startedAt;
    private Instant finishedAt;
    private String failureSummary;
    private Instant updateTime;
    private boolean reused;
    private String taskId;
    private String taskStatus;
    private List<CompilationStageView> stages = new ArrayList<>();
    private ArtifactView artifact;

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getScopeId() {
        return scopeId;
    }

    public void setScopeId(String scopeId) {
        this.scopeId = scopeId;
    }

    public Integer getScopeCount() {
        return scopeCount;
    }

    public void setScopeCount(Integer scopeCount) {
        this.scopeCount = scopeCount;
    }

    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public Integer getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(Integer successCount) {
        this.successCount = successCount;
    }

    public Integer getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(Integer failedCount) {
        this.failedCount = failedCount;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getPipelineType() {
        return pipelineType;
    }

    public void setPipelineType(String pipelineType) {
        this.pipelineType = pipelineType;
    }

    public String getConfigVersion() {
        return configVersion;
    }

    public void setConfigVersion(String configVersion) {
        this.configVersion = configVersion;
    }

    public String getConfigSnapshot() {
        return configSnapshot;
    }

    public void setConfigSnapshot(String configSnapshot) {
        this.configSnapshot = configSnapshot;
    }

    public String getCompilerVersion() {
        return compilerVersion;
    }

    public void setCompilerVersion(String compilerVersion) {
        this.compilerVersion = compilerVersion;
    }

    public String getRunStatus() {
        return runStatus;
    }

    public void setRunStatus(String runStatus) {
        this.runStatus = runStatus;
    }

    public String getMilestone() {
        return milestone;
    }

    public void setMilestone(String milestone) {
        this.milestone = milestone;
    }

    public String getCurrentStage() {
        return currentStage;
    }

    public void setCurrentStage(String currentStage) {
        this.currentStage = currentStage;
    }

    public Integer getChunkCount() {
        return chunkCount;
    }

    public void setChunkCount(Integer chunkCount) {
        this.chunkCount = chunkCount;
    }

    public Instant getM1At() {
        return m1At;
    }

    public void setM1At(Instant m1At) {
        this.m1At = m1At;
    }

    public Instant getM2At() {
        return m2At;
    }

    public void setM2At(Instant m2At) {
        this.m2At = m2At;
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

    public String getFailureSummary() {
        return failureSummary;
    }

    public void setFailureSummary(String failureSummary) {
        this.failureSummary = failureSummary;
    }

    public Instant getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Instant updateTime) {
        this.updateTime = updateTime;
    }

    public boolean isReused() {
        return reused;
    }

    public void setReused(boolean reused) {
        this.reused = reused;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getTaskStatus() {
        return taskStatus;
    }

    public void setTaskStatus(String taskStatus) {
        this.taskStatus = taskStatus;
    }

    public List<CompilationStageView> getStages() {
        return stages;
    }

    public void setStages(List<CompilationStageView> stages) {
        this.stages = stages;
    }

    public ArtifactView getArtifact() {
        return artifact;
    }

    public void setArtifact(ArtifactView artifact) {
        this.artifact = artifact;
    }
}
