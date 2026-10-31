package com.zifang.z.kb.api.resource;

import java.time.Instant;

/**
 * 知识库（一等资源，对齐参考实现 KnowledgeBaseDO）。
 */
public class KnowledgeBase {

    private String kbId;
    private String tenantCode;
    private String name;
    private String code;
    private KnowledgeBaseType type = KnowledgeBaseType.FILE;
    private String description;
    private String ownerId;
    private KnowledgeBaseStatus status = KnowledgeBaseStatus.ACTIVE;
    /** 创建后锁定的嵌入模型标识 */
    private String embeddingModel;
    /** 本体图空间标识（与 z-ontology 的软关联，不写本体） */
    private String primaryGraphSpaceKey;
    private Instant archivedAt;
    private Instant createdAt;
    private Instant updatedAt;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public KnowledgeBaseType getType() {
        return type;
    }

    public void setType(KnowledgeBaseType type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public KnowledgeBaseStatus getStatus() {
        return status;
    }

    public void setStatus(KnowledgeBaseStatus status) {
        this.status = status;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public String getPrimaryGraphSpaceKey() {
        return primaryGraphSpaceKey;
    }

    public void setPrimaryGraphSpaceKey(String primaryGraphSpaceKey) {
        this.primaryGraphSpaceKey = primaryGraphSpaceKey;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
