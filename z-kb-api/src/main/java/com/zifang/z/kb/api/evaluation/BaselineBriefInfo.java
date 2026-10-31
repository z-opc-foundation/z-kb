package com.zifang.z.kb.api.evaluation;

import java.time.Instant;

/**
 * 基线跑批摘要。
 */
public class BaselineBriefInfo {

    private String runId;
    private Instant finishedAt;

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
}
