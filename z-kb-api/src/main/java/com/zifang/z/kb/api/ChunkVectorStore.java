package com.zifang.z.kb.api;

import java.util.List;
import java.util.Map;

/**
 * 块向量存储抽象 — 封装底层向量库（z-vector / Milvus / Qdrant 等）。
 *
 * <p>设计要点：
 * <ul>
 *   <li>{@code workspace} 作为 Collection 命名空间（kb_<workspace>_<name>）</li>
 *   <li>{@link #upsert} 幂等（同 ID 覆盖）</li>
 *   <li>{@link #search} 返回 ANN topK + 过滤</li>
 *   <li>{@link #deleteByDocument} 级联删除某文档的全部块向量</li>
 * </ul>
 */
public interface ChunkVectorStore {

    /** 创建一个 collection（workspace + collectionName 维度隔离） */
    void createCollection(String workspace, String collectionName, int dimension);

    /** collection 是否存在 */
    boolean hasCollection(String workspace, String collectionName);

    /** 删除 collection */
    boolean deleteCollection(String workspace, String collectionName);

    /** 写入/覆盖 chunks 及其 embedding */
    void upsert(String workspace, String collectionName, List<Chunk> chunks);

    /** ANN 搜索 */
    List<VectorMatch> search(String workspace, String collectionName,
                              float[] queryVector, int topK,
                              Map<String, Object> filter);

    /** 删除单个 chunk */
    boolean delete(String workspace, String collectionName, String chunkId);

    /** 级联删除某文档的全部 chunk 向量 */
    int deleteByDocument(String workspace, String collectionName, String documentId);

    /** 集合内 chunk 数 */
    long count(String workspace, String collectionName);

    /** 关闭底层资源 */
    void close();

    /** 向量命中结果 */
    class VectorMatch {
        public final String chunkId;
        public final String documentId;
        public final float score;
        public final Map<String, Object> payload;

        public VectorMatch(String chunkId, String documentId, float score, Map<String, Object> payload) {
            this.chunkId = chunkId;
            this.documentId = documentId;
            this.score = score;
            this.payload = payload;
        }
    }
}
