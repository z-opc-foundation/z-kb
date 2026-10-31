package com.zifang.z.kb.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 配置发布后的重建影响分析。
 */
public class ConfigImpact {

    /** FULL / INCREMENTAL / NONE */
    private String rebuildMode = "NONE";
    private int fullRebuildCount;
    private int incrementalCount;
    private int unaffectedCount;
    private List<String> notes = new ArrayList<>();

    public String getRebuildMode() {
        return rebuildMode;
    }

    public void setRebuildMode(String rebuildMode) {
        this.rebuildMode = rebuildMode;
    }

    public int getFullRebuildCount() {
        return fullRebuildCount;
    }

    public void setFullRebuildCount(int fullRebuildCount) {
        this.fullRebuildCount = fullRebuildCount;
    }

    public int getIncrementalCount() {
        return incrementalCount;
    }

    public void setIncrementalCount(int incrementalCount) {
        this.incrementalCount = incrementalCount;
    }

    public int getUnaffectedCount() {
        return unaffectedCount;
    }

    public void setUnaffectedCount(int unaffectedCount) {
        this.unaffectedCount = unaffectedCount;
    }

    public List<String> getNotes() {
        return notes;
    }

    public void setNotes(List<String> notes) {
        this.notes = notes;
    }
}
