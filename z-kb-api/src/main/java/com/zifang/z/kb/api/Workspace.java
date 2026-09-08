package com.zifang.z.kb.api;

import java.time.Instant;

/**
 * 工作台 — 知识库的多租户隔离单元。
 *
 * <p>每个 Workspace 拥有独立的文档/块/实体/关系/向量索引。
 * 类似 Anything-LLM 的 "Workspace" 概念。
 */
public class Workspace {

    private String id;
    private String name;
    private String description;
    private String ownerId;
    private long documentCount;
    private long chunkCount;
    private long entityCount;
    private long relationCount;
    private String embeddingProvider;
    private boolean active = true;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public Workspace() { this.id = java.util.UUID.randomUUID().toString(); }
    public Workspace(String name) { this(); this.name = name; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public long getDocumentCount() { return documentCount; }
    public void setDocumentCount(long documentCount) { this.documentCount = documentCount; }
    public long getChunkCount() { return chunkCount; }
    public void setChunkCount(long chunkCount) { this.chunkCount = chunkCount; }
    public long getEntityCount() { return entityCount; }
    public void setEntityCount(long entityCount) { this.entityCount = entityCount; }
    public long getRelationCount() { return relationCount; }
    public void setRelationCount(long relationCount) { this.relationCount = relationCount; }
    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String embeddingProvider) { this.embeddingProvider = embeddingProvider; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
