package com.zifang.z.kb.api.resource;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 知识库配置版本（草稿 / 生效 / 历史）。
 */
public class KnowledgeBaseProfileVersion {

    private String versionId;
    private String kbId;
    private String tenantCode;
    private int versionNo;
    private ProfileVersionStatus status = ProfileVersionStatus.DRAFT;
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
    private String remark;
    private String publishedBy;
    private Instant publishedAt;
    private Instant createdAt;

    public String getVersionId() {
        return versionId;
    }

    public void setVersionId(String versionId) {
        this.versionId = versionId;
    }

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

    public int getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(int versionNo) {
        this.versionNo = versionNo;
    }

    public ProfileVersionStatus getStatus() {
        return status;
    }

    public void setStatus(ProfileVersionStatus status) {
        this.status = status;
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

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(String publishedBy) {
        this.publishedBy = publishedBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
