package com.zifang.z.kb.api.evaluation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 评测口径下的知识库列表项。
 */
public class EvaluationKbItemInfo {

    private String kbId;
    private String kbName;
    private Integer datasetVersion;
    private String datasetStatus;
    private Integer caseCount;
    private String lastRunId;
    private Instant lastRunAt;
    private Boolean resultUsable;
    private int corePassCount;
    private int coreTotal;
    private long openBadcaseCount;
    private List<String> notConnected = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getKbName() {
        return kbName;
    }

    public void setKbName(String kbName) {
        this.kbName = kbName;
    }

    public Integer getDatasetVersion() {
        return datasetVersion;
    }

    public void setDatasetVersion(Integer datasetVersion) {
        this.datasetVersion = datasetVersion;
    }

    public String getDatasetStatus() {
        return datasetStatus;
    }

    public void setDatasetStatus(String datasetStatus) {
        this.datasetStatus = datasetStatus;
    }

    public Integer getCaseCount() {
        return caseCount;
    }

    public void setCaseCount(Integer caseCount) {
        this.caseCount = caseCount;
    }

    public String getLastRunId() {
        return lastRunId;
    }

    public void setLastRunId(String lastRunId) {
        this.lastRunId = lastRunId;
    }

    public Instant getLastRunAt() {
        return lastRunAt;
    }

    public void setLastRunAt(Instant lastRunAt) {
        this.lastRunAt = lastRunAt;
    }

    public Boolean getResultUsable() {
        return resultUsable;
    }

    public void setResultUsable(Boolean resultUsable) {
        this.resultUsable = resultUsable;
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

    public long getOpenBadcaseCount() {
        return openBadcaseCount;
    }

    public void setOpenBadcaseCount(long openBadcaseCount) {
        this.openBadcaseCount = openBadcaseCount;
    }

    public List<String> getNotConnected() {
        return notConnected;
    }

    public void setNotConnected(List<String> notConnected) {
        this.notConnected = notConnected;
    }
}
