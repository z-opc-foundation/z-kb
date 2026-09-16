package com.zifang.z.kb.vector.impl;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.vector.api.DistanceMetric;
import com.zifang.z.vector.api.Filter;
import com.zifang.z.vector.api.IndexType;
import com.zifang.z.vector.api.SearchResult;
import com.zifang.z.vector.api.VectorPoint;
import com.zifang.z.vector.api.VectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 基于 z-vector 的 ChunkVectorStore 实现 — 适配器模式。
 *
 * <p>每个 workspace 对应一个独立的 Collection：
 * {@code kb_<sanitized_workspace>_chunks}
 */
public class ZVectorChunkVectorStore implements ChunkVectorStore {

    private static final Logger log = LoggerFactory.getLogger(ZVectorChunkVectorStore.class);

    private final VectorStore vectorStore;
    private final int defaultDimension;

    public ZVectorChunkVectorStore(VectorStore vectorStore, int defaultDimension) {
        this.vectorStore = vectorStore;
        this.defaultDimension = defaultDimension;
    }

    private String collectionName(String workspace) {
        // 工作台名做安全转换（去除特殊字符）
        String safe = workspace.replaceAll("[^a-zA-Z0-9_]", "_");
        return "kb_" + safe + "_chunks";
    }

    @Override
    public void createCollection(String workspace, String collectionName, int dimension) {
        String name = collectionName(workspace) + "_" + collectionName;
        try {
            vectorStore.createCollection(name, dimension, DistanceMetric.COSINE, IndexType.HNSW, null);
            log.info("Created vector collection: {} (dim={})", name, dimension);
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("already exists")) {
                log.debug("Vector collection already exists: {}", name);
                return;
            }
            throw e;
        }
    }

    @Override
    public boolean hasCollection(String workspace, String collectionName) {
        return vectorStore.hasCollection(collectionName(workspace) + "_" + collectionName);
    }

    @Override
    public boolean deleteCollection(String workspace, String collectionName) {
        return vectorStore.deleteCollection(collectionName(workspace) + "_" + collectionName);
    }

    @Override
    public void upsert(String workspace, String collectionName, List<Chunk> chunks) {
        if (chunks == null || chunks.isEmpty()) return;
        String fullName = collectionName(workspace) + "_" + collectionName;
        if (!vectorStore.hasCollection(fullName)) {
            vectorStore.createCollection(fullName, defaultDimension, DistanceMetric.COSINE, IndexType.HNSW, null);
        }
        List<VectorPoint> points = new ArrayList<>(chunks.size());
        for (Chunk chunk : chunks) {
            float[] vec = chunk.getEmbedding();
            if (vec == null) {
                log.warn("Chunk {} has no embedding, skipping", chunk.getId());
                continue;
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("documentId", chunk.getDocumentId());
            payload.put("ordinal", chunk.getOrdinal());
            payload.put("workspace", chunk.getWorkspace());
            if (chunk.getContextTitle() != null) payload.put("contextTitle", chunk.getContextTitle());
            points.add(new VectorPoint(chunk.getId(), vec, payload));
        }
        if (!points.isEmpty()) {
            vectorStore.upsertBatch(fullName, points);
        }
    }

    @Override
    public List<VectorMatch> search(String workspace, String collectionName,
                                     float[] queryVector, int topK, Map<String, Object> filter) {
        String fullName = collectionName(workspace) + "_" + collectionName;
        if (!vectorStore.hasCollection(fullName)) return new ArrayList<>();

        Filter zFilter = null;
        if (filter != null && !filter.isEmpty()) {
            // 简化：仅支持等值过滤
            for (Map.Entry<String, Object> e : filter.entrySet()) {
                if (zFilter == null) {
                    zFilter = Filter.eq(e.getKey(), e.getValue());
                } else {
                    zFilter = zFilter.and(Filter.eq(e.getKey(), e.getValue()));
                }
            }
        }

        List<SearchResult> results = vectorStore.search(fullName, queryVector, topK, zFilter);
        List<VectorMatch> matches = new ArrayList<>(results.size());
        for (SearchResult r : results) {
            String documentId = r.getPayload() != null && r.getPayload().get("documentId") != null
                    ? r.getPayload().get("documentId").toString() : null;
            matches.add(new VectorMatch(r.getVectorId(), documentId, r.getScore(), r.getPayload()));
        }
        return matches;
    }

    @Override
    public boolean delete(String workspace, String collectionName, String chunkId) {
        String fullName = collectionName(workspace) + "_" + collectionName;
        return vectorStore.deletePoint(fullName, chunkId);
    }

    @Override
    public int deleteByDocument(String workspace, String collectionName, String documentId) {
        String fullName = collectionName(workspace) + "_" + collectionName;
        // 通过 payload 过滤删除该文档的所有 chunk
        List<SearchResult> matched = vectorStore.search(fullName, new float[defaultDimension], 10000, Filter.eq("documentId", documentId));
        int deleted = 0;
        for (SearchResult r : matched) {
            if (vectorStore.deletePoint(fullName, r.getVectorId())) deleted++;
        }
        return deleted;
    }

    @Override
    public long count(String workspace, String collectionName) {
        String fullName = collectionName(workspace) + "_" + collectionName;
        if (!vectorStore.hasCollection(fullName)) return 0;
        return vectorStore.getPointCount(fullName);
    }

    @Override
    public void close() {
        try {
            vectorStore.close();
        } catch (Exception e) {
            log.warn("Close vector store failed: {}", e.getMessage());
        }
    }
}
