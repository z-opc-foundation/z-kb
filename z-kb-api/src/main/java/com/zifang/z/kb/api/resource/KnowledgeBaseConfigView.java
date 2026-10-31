package com.zifang.z.***REMOVED***.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库配置总览（对齐参考实现 KnowledgeBaseConfigResponse）：
 * 当前版本、草稿、历史版本，以及草稿差异、重建影响与校验结果。
 */
public class KnowledgeBaseConfigView {

    private String ***REMOVED***Id;
    private String ***REMOVED***Name;
    private KnowledgeBaseType type;
    private String embeddingModel;
    private boolean canManage;
    private KnowledgeBaseProfileVersion current;
    private KnowledgeBaseProfileVersion draft;
    private List<KnowledgeBaseProfileVersion> versions = new ArrayList<>();
    private List<ConfigDiff> diff = new ArrayList<>();
    private ConfigImpact impact = new ConfigImpact();
    private ConfigValidation validation = new ConfigValidation();

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

    public KnowledgeBaseType getType() {
        return type;
    }

    public void setType(KnowledgeBaseType type) {
        this.type = type;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public boolean isCanManage() {
        return canManage;
    }

    public void setCanManage(boolean canManage) {
        this.canManage = canManage;
    }

    public KnowledgeBaseProfileVersion getCurrent() {
        return current;
    }

    public void setCurrent(KnowledgeBaseProfileVersion current) {
        this.current = current;
    }

    public KnowledgeBaseProfileVersion getDraft() {
        return draft;
    }

    public void setDraft(KnowledgeBaseProfileVersion draft) {
        this.draft = draft;
    }

    public List<KnowledgeBaseProfileVersion> getVersions() {
        return versions;
    }

    public void setVersions(List<KnowledgeBaseProfileVersion> versions) {
        this.versions = versions;
    }

    public List<ConfigDiff> getDiff() {
        return diff;
    }

    public void setDiff(List<ConfigDiff> diff) {
        this.diff = diff;
    }

    public ConfigImpact getImpact() {
        return impact;
    }

    public void setImpact(ConfigImpact impact) {
        this.impact = impact;
    }

    public ConfigValidation getValidation() {
        return validation;
    }

    public void setValidation(ConfigValidation validation) {
        this.validation = validation;
    }
}
