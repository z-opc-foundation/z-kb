package com.zifang.z.kb.api.evaluation;

import java.time.Instant;

/**
 * 跑批摘要。
 */
public class RunBriefInfo {

    private String runId;
    private String status;
    private Boolean resultUsable;
    private Instant finishedAt;
    private Long durationMs;
    private int corePassCount;
    private int coreTotal;

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

    public int getCorePassCount() {
        return corePassCount;
    }

    public void setCorePassCount(int corePassCount) {
        this.corePassCount = corePassCount;
    }

    public int getCoreTotal() {
        return coreTotal;
    }

    public void setCoreTotal(int coreTotal) {
        this.coreTotal = coreTotal;
    }
}
