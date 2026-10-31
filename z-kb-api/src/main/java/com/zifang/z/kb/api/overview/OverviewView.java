package com.zifang.z.kb.api.overview;

import com.zifang.z.kb.api.material.MaterialView;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 知识库概览统计（对齐参考实现 OverviewResponse）。
 */
public class OverviewView {

    private String kbId;
    private long fileCount;
    private long compiledCount;
    private long partialCount;
    private long notCompiledCount;
    private long wikiCount;
    private long runningTaskCount;
    private long failedCount;
    private Instant refreshedAt;
    private List<MaterialView> recentMaterials = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public long getFileCount() {
        return fileCount;
    }

    public void setFileCount(long fileCount) {
        this.fileCount = fileCount;
    }

    public long getCompiledCount() {
        return compiledCount;
    }

    public void setCompiledCount(long compiledCount) {
        this.compiledCount = compiledCount;
    }

    public long getPartialCount() {
        return partialCount;
    }

    public void setPartialCount(long partialCount) {
        this.partialCount = partialCount;
    }

    public long getNotCompiledCount() {
        return notCompiledCount;
    }

    public void setNotCompiledCount(long notCompiledCount) {
        this.notCompiledCount = notCompiledCount;
    }

    public long getWikiCount() {
        return wikiCount;
    }

    public void setWikiCount(long wikiCount) {
        this.wikiCount = wikiCount;
    }

    public long getRunningTaskCount() {
        return runningTaskCount;
    }

    public void setRunningTaskCount(long runningTaskCount) {
        this.runningTaskCount = runningTaskCount;
    }

    public long getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(long failedCount) {
        this.failedCount = failedCount;
    }

    public Instant getRefreshedAt() {
        return refreshedAt;
    }

    public void setRefreshedAt(Instant refreshedAt) {
        this.refreshedAt = refreshedAt;
    }

    public List<MaterialView> getRecentMaterials() {
        return recentMaterials;
    }

    public void setRecentMaterials(List<MaterialView> recentMaterials) {
        this.recentMaterials = recentMaterials;
    }
}
