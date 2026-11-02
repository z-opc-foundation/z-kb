package com.zifang.z.kb.api;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 工作台综合统计。
 */
public class KBStatistics {

    private String workspace;
    private long documentCount;
    private long chunkCount;
    private long entityCount;
    private long relationCount;
    private long embeddingCount;
    private long totalSizeBytes;
    private String embeddingProvider;
    /** 工作台内的标签云 */
    private Map<String, Long> tagCloud = new LinkedHashMap<>();
    /** 工作台内的实体类型分布 */
    private Map<String, Long> entityTypeDistribution = new LinkedHashMap<>();
    private long generatedAtMs;

    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public long getDocumentCount() { return documentCount; }
    public void setDocumentCount(long documentCount) { this.documentCount = documentCount; }
    public long getChunkCount() { return chunkCount; }
    public void setChunkCount(long chunkCount) { this.chunkCount = chunkCount; }
    public long getEntityCount() { return entityCount; }
    public void setEntityCount(long entityCount) { this.entityCount = entityCount; }
    public long getRelationCount() { return relationCount; }
    public void setRelationCount(long relationCount) { this.relationCount = relationCount; }
    public long getEmbeddingCount() { return embeddingCount; }
    public void setEmbeddingCount(long embeddingCount) { this.embeddingCount = embeddingCount; }
    public long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }
    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String embeddingProvider) { this.embeddingProvider = embeddingProvider; }
    public Map<String, Long> getTagCloud() { return tagCloud; }
    public void setTagCloud(Map<String, Long> tagCloud) { this.tagCloud = tagCloud; }
    public Map<String, Long> getEntityTypeDistribution() { return entityTypeDistribution; }
    public void setEntityTypeDistribution(Map<String, Long> entityTypeDistribution) { this.entityTypeDistribution = entityTypeDistribution; }
    public long getGeneratedAtMs() { return generatedAtMs; }
    public void setGeneratedAtMs(long generatedAtMs) { this.generatedAtMs = generatedAtMs; }
}
