package com.zifang.z.kb.api.resource;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 知识库当前生效配置（对齐参考实现 KnowledgeBaseProfileDO）。
 *
 * <p>策略字段用 Map 承载（parserPolicy / chunkingPolicy / retrievalPolicy …），
 * 键与取值由各域自行约定，避免在 api 层为每类策略造一个值对象。</p>
 */
public class KnowledgeBaseProfile {

    private String kbId;
    private String tenantCode;
    private KnowledgeBaseType type;
    private String presetVersion;
    private Map<String, Object> parserPolicy = new LinkedHashMap<>();
    private Map<String, Object> chunkingPolicy = new LinkedHashMap<>();
    private Map<String, Object> extractionPolicy = new LinkedHashMap<>();
    private Map<String, Object> wikiPolicy = new LinkedHashMap<>();
    private Map<String, Object> graphPolicy = new LinkedHashMap<>();
    private Map<String, Object> reviewPolicy = new LinkedHashMap<>();
    private Map<String, Object> freshnessPolicy = new LinkedHashMap<>();
    private Map<String, Object> retrievalPolicy = new LinkedHashMap<>();
    private Map<String, Object> sourcePolicy = new LinkedHashMap<>();
    private int configVersion;
    private java.time.Instant updatedAt;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getTenantCode() {
        return tenantCode;
    }

    public void setTenantCode(String tenantCode) {
        this.tenantCode = tenantCode;
    }

    public KnowledgeBaseType getType() {
        return type;
    }

    public void setType(KnowledgeBaseType type) {
        this.type = type;
    }

    public String getPresetVersion() {
        return presetVersion;
    }

    public void setPresetVersion(String presetVersion) {
        this.presetVersion = presetVersion;
    }

    public Map<String, Object> getParserPolicy() {
        return parserPolicy;
    }

    public void setParserPolicy(Map<String, Object> parserPolicy) {
        this.parserPolicy = parserPolicy;
    }

    public Map<String, Object> getChunkingPolicy() {
        return chunkingPolicy;
    }

    public void setChunkingPolicy(Map<String, Object> chunkingPolicy) {
        this.chunkingPolicy = chunkingPolicy;
    }

    public Map<String, Object> getExtractionPolicy() {
        return extractionPolicy;
    }

    public void setExtractionPolicy(Map<String, Object> extractionPolicy) {
        this.extractionPolicy = extractionPolicy;
    }

    public Map<String, Object> getWikiPolicy() {
        return wikiPolicy;
    }

    public void setWikiPolicy(Map<String, Object> wikiPolicy) {
        this.wikiPolicy = wikiPolicy;
    }

    public Map<String, Object> getGraphPolicy() {
        return graphPolicy;
    }

    public void setGraphPolicy(Map<String, Object> graphPolicy) {
        this.graphPolicy = graphPolicy;
    }

    public Map<String, Object> getReviewPolicy() {
        return reviewPolicy;
    }

    public void setReviewPolicy(Map<String, Object> reviewPolicy) {
        this.reviewPolicy = reviewPolicy;
    }

    public Map<String, Object> getFreshnessPolicy() {
        return freshnessPolicy;
    }

    public void setFreshnessPolicy(Map<String, Object> freshnessPolicy) {
        this.freshnessPolicy = freshnessPolicy;
    }

    public Map<String, Object> getRetrievalPolicy() {
        return retrievalPolicy;
    }

    public void setRetrievalPolicy(Map<String, Object> retrievalPolicy) {
        this.retrievalPolicy = retrievalPolicy;
    }

    public Map<String, Object> getSourcePolicy() {
        return sourcePolicy;
    }

    public void setSourcePolicy(Map<String, Object> sourcePolicy) {
        this.sourcePolicy = sourcePolicy;
    }

    public int getConfigVersion() {
        return configVersion;
    }

    public void setConfigVersion(int configVersion) {
        this.configVersion = configVersion;
    }

    public java.time.Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(java.time.Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
