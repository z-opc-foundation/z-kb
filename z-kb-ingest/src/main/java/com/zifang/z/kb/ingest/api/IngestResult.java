package com.zifang.z.kb.ingest.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 接入结果 — 一条 IngestRequest 的处理结果。
 */
public class IngestResult {

    public enum Status { SUCCESS, FAILED, SKIPPED_DUPLICATE, INVALID }

    private String requestId;
    private Status status = Status.SUCCESS;
    private String documentId;
    private String error;
    private int chunkCount;
    private int entityCount;
    private int relationCount;
    private long elapsedMillis;
    private Instant processedAt = Instant.now();

    /** 流水线步骤日志，便于排错 */
    private List<String> pipelineLog = new ArrayList<>();

    public IngestResult() {}

    public IngestResult(String requestId, Status status) {
        this.requestId = requestId;
        this.status = status;
    }

    public static IngestResult success(String requestId, String documentId,
                                        int chunkCount, int entityCount, int relationCount, long elapsedMillis) {
        IngestResult r = new IngestResult(requestId, Status.SUCCESS);
        r.documentId = documentId;
        r.chunkCount = chunkCount;
        r.entityCount = entityCount;
        r.relationCount = relationCount;
        r.elapsedMillis = elapsedMillis;
        return r;
    }

    public static IngestResult failed(String requestId, String error) {
        IngestResult r = new IngestResult(requestId, Status.FAILED);
        r.error = error;
        return r;
    }

    public void log(String step) {
        this.pipelineLog.add(String.format("[%s] %s", Instant.now(), step));
    }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }
    public int getEntityCount() { return entityCount; }
    public void setEntityCount(int entityCount) { this.entityCount = entityCount; }
    public int getRelationCount() { return relationCount; }
    public void setRelationCount(int relationCount) { this.relationCount = relationCount; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
    public List<String> getPipelineLog() { return pipelineLog; }
    public void setPipelineLog(List<String> pipelineLog) { this.pipelineLog = pipelineLog; }
}