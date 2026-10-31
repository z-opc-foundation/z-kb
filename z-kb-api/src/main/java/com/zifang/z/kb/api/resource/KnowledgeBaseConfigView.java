package com.zifang.z.kb.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库配置总览（对齐参考实现 KnowledgeBaseConfigResponse）：
 * 当前版本、草稿、历史版本，以及草稿差异、重建影响与校验结果。
 */
public class KnowledgeBaseConfigView {

    private String kbId;
    private String kbName;
    private KnowledgeBaseType type;
    private String embeddingModel;
    private boolean canManage;
    private KnowledgeBaseProfileVersion current;
    private KnowledgeBaseProfileVersion draft;
    private List<KnowledgeBaseProfileVersion> versions = new ArrayList<>();
    private List<ConfigDiff> diff = new ArrayList<>();
    private ConfigImpact impact = new ConfigImpact();
    private ConfigValidation validation = new ConfigValidation();

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
