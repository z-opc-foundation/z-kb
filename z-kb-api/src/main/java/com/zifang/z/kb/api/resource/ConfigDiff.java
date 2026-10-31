package com.zifang.z.kb.api.resource;

/**
 * 配置版本差异项（对齐参考实现 ConfigDiffInfo）。
 */
public class ConfigDiff {

    /** 字段名，如 parserPolicy */
    private String field;
    /** 展示名，如 解析策略 */
    private String label;
    /** 作用域：PARSE/CHUNK/EXTRACT/WIKI/GRAPH/FLOW/SEARCH */
    private String scope;
    private String before;
    private String after;
    /** 该字段变化导致的重建方式：FULL/INCREMENTAL/NONE */
    private String rebuildMode;

    public ConfigDiff() {
    }

    public ConfigDiff(String field, String label, String scope, String before, String after,
                      String rebuildMode) {
        this.field = field;
        this.label = label;
        this.scope = scope;
        this.before = before;
        this.after = after;
        this.rebuildMode = rebuildMode;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getBefore() {
        return before;
    }

    public void setBefore(String before) {
        this.before = before;
    }

    public String getAfter() {
        return after;
    }

    public void setAfter(String after) {
        this.after = after;
    }

    public String getRebuildMode() {
        return rebuildMode;
    }

    public void setRebuildMode(String rebuildMode) {
        this.rebuildMode = rebuildMode;
    }
}
