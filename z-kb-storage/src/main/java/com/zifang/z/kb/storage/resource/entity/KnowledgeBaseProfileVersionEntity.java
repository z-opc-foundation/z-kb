package com.zifang.z.kb.storage.resource.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 知识库配置版本（zkb_knowledge_base_profile_version）：草稿 / 生效 / 历史。
 */
@TableName("zkb_knowledge_base_profile_version")
public class KnowledgeBaseProfileVersionEntity {

    @TableId(type = IdType.INPUT)
    private String id;
    private String kbId;
    private String tenantCode;
    private Integer versionNo;
    private String status;
    private String presetVersion;
    private String parserPolicy;
    private String chunkingPolicy;
    private String extractionPolicy;
    private String wikiPolicy;
    private String graphPolicy;
    private String reviewPolicy;
    private String freshnessPolicy;
    private String retrievalPolicy;
    private String sourcePolicy;
    private String remark;
    private String publishedBy;
    private Instant publishedAt;
    private String createBy;
    private String updateBy;
    private Instant createTime;
    private Instant updateTime;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public Integer getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPresetVersion() {
        return presetVersion;
    }

    public void setPresetVersion(String presetVersion) {
        this.presetVersion = presetVersion;
    }

    public String getParserPolicy() {
        return parserPolicy;
    }

    public void setParserPolicy(String parserPolicy) {
        this.parserPolicy = parserPolicy;
    }

    public String getChunkingPolicy() {
        return chunkingPolicy;
    }

    public void setChunkingPolicy(String chunkingPolicy) {
        this.chunkingPolicy = chunkingPolicy;
    }

    public String getExtractionPolicy() {
        return extractionPolicy;
    }

    public void setExtractionPolicy(String extractionPolicy) {
        this.extractionPolicy = extractionPolicy;
    }

    public String getWikiPolicy() {
        return wikiPolicy;
    }

    public void setWikiPolicy(String wikiPolicy) {
        this.wikiPolicy = wikiPolicy;
    }

    public String getGraphPolicy() {
        return graphPolicy;
    }

    public void setGraphPolicy(String graphPolicy) {
        this.graphPolicy = graphPolicy;
    }

    public String getReviewPolicy() {
        return reviewPolicy;
    }

    public void setReviewPolicy(String reviewPolicy) {
        this.reviewPolicy = reviewPolicy;
    }

    public String getFreshnessPolicy() {
        return freshnessPolicy;
    }

    public void setFreshnessPolicy(String freshnessPolicy) {
        this.freshnessPolicy = freshnessPolicy;
    }

    public String getRetrievalPolicy() {
        return retrievalPolicy;
    }

    public void setRetrievalPolicy(String retrievalPolicy) {
        this.retrievalPolicy = retrievalPolicy;
    }

    public String getSourcePolicy() {
        return sourcePolicy;
    }

    public void setSourcePolicy(String sourcePolicy) {
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

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public String getUpdateBy() {
        return updateBy;
    }

    public void setUpdateBy(String updateBy) {
        this.updateBy = updateBy;
    }

    public Instant getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Instant createTime) {
        this.createTime = createTime;
    }

    public Instant getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Instant updateTime) {
        this.updateTime = updateTime;
    }
}
