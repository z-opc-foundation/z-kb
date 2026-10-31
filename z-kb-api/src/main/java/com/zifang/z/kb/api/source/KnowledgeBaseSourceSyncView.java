package com.zifang.z.kb.api.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次接入源同步的回执与计数。
 *
 * <p>z-kb 没有独立任务内核，同步在请求内跑完；scopeId 为本次同步的运行标识，
 * reusing 保留参考契约的形状（同源并发时由实现决定是否复用）。</p>
 */
public class KnowledgeBaseSourceSyncView {

    private String scopeId;
    private String sourceId;
    private String provider;
    private boolean reusing;
    private String summary;
    private int created;
    private int updated;
    private int unchanged;
    private int skipped;
    private int retired;
    private int failed;
    private List<String> failures = new ArrayList<>();

    public String getScopeId() {
        return scopeId;
    }

    public void setScopeId(String scopeId) {
        this.scopeId = scopeId;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public boolean isReusing() {
        return reusing;
    }

    public void setReusing(boolean reusing) {
        this.reusing = reusing;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public int getCreated() {
        return created;
    }

    public void setCreated(int created) {
        this.created = created;
    }

    public int getUpdated() {
        return updated;
    }

    public void setUpdated(int updated) {
        this.updated = updated;
    }

    public int getUnchanged() {
        return unchanged;
    }

    public void setUnchanged(int unchanged) {
        this.unchanged = unchanged;
    }

    public int getSkipped() {
        return skipped;
    }

    public void setSkipped(int skipped) {
        this.skipped = skipped;
    }

    public int getRetired() {
        return retired;
    }

    public void setRetired(int retired) {
        this.retired = retired;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }

    public List<String> getFailures() {
        return failures;
    }

    public void setFailures(List<String> failures) {
        this.failures = failures;
    }
}
