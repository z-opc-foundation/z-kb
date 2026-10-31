package com.zifang.z.***REMOVED***.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 单库评测概览。
 */
public class EvaluationOverviewInfo {

    private String ***REMOVED***Id;
    private String ***REMOVED***Name;
    private DatasetSummaryInfo dataset;
    private RunBriefInfo lastRun;
    private BaselineBriefInfo baselineRun;
    private boolean comparable;
    private BadcaseCountInfo badcaseCounts = new BadcaseCountInfo();
    private List<TrustEvidenceInfo> evidence = new ArrayList<>();
    private List<String> notConnected = new ArrayList<>();

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public String get***REMOVED***Name() {
        return ***REMOVED***Name;
    }

    public void set***REMOVED***Name(String ***REMOVED***Name) {
        this.***REMOVED***Name = ***REMOVED***Name;
    }

    public DatasetSummaryInfo getDataset() {
        return dataset;
    }

    public void setDataset(DatasetSummaryInfo dataset) {
        this.dataset = dataset;
    }

    public RunBriefInfo getLastRun() {
        return lastRun;
    }

    public void setLastRun(RunBriefInfo lastRun) {
        this.lastRun = lastRun;
    }

    public BaselineBriefInfo getBaselineRun() {
        return baselineRun;
    }

    public void setBaselineRun(BaselineBriefInfo baselineRun) {
        this.baselineRun = baselineRun;
    }

    public boolean isComparable() {
        return comparable;
    }

    public void setComparable(boolean comparable) {
        this.comparable = comparable;
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

    public List<String> getNotConnected() {
        return notConnected;
    }

    public void setNotConnected(List<String> notConnected) {
        this.notConnected = notConnected;
    }
}
