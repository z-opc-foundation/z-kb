package com.zifang.z.kb.api;

import java.time.Instant;

/**
 * 导入结果 — 批量导入文档后的回执。
 */
public class ImportResult {

    private String documentId;
    private String title;
    private int chunkCount;
    private int entityCount;
    private int relationCount;
    private long elapsedMillis;
    private boolean success = true;
    private String errorMessage;
    private Instant indexedAt = Instant.now();

    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }
    public int getEntityCount() { return entityCount; }
    public void setEntityCount(int entityCount) { this.entityCount = entityCount; }
    public int getRelationCount() { return relationCount; }
    public void setRelationCount(int relationCount) { this.relationCount = relationCount; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Instant getIndexedAt() { return indexedAt; }
    public void setIndexedAt(Instant indexedAt) { this.indexedAt = indexedAt; }
}
