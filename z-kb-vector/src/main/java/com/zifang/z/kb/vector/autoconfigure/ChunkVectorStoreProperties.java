package com.zifang.z.kb.vector.autoconfigure;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * z-kb-vector 配置属性。
 *
 * <p><b>1.1.0 破坏性变更</b>：{@code storage-type} 的默认值由 {@code in-memory} 翻成
 * {@code persistent}（向量默认落 {@code PersistentVectorStore}，重启不丢向量）。
 * 要回到旧行为请显式配 {@code zkb.vector.storage-type=in-memory}。
 */
@ConfigurationProperties(prefix = "zkb.vector")
public class ChunkVectorStoreProperties {

    /** persistent（1.1.0 起的默认，落 PersistentVectorStore）/ in-memory（内存向量，重启不保留）。 */
    private String storageType = "persistent";
    /** 持久化向量目录；支持 {@code ~} 展开，默认 {@code ~/.zkb/vector}。 */
    private String dataDir = "~/.zkb/vector";
    private int dimension = 512;
    private String indexType = "HNSW";
    private String metric = "COSINE";

    public String getStorageType() { return storageType; }
    public void setStorageType(String storageType) { this.storageType = storageType; }
    public String getDataDir() { return dataDir; }
    public void setDataDir(String dataDir) { this.dataDir = dataDir; }
    public int getDimension() { return dimension; }
    public void setDimension(int dimension) { this.dimension = dimension; }
    public String getIndexType() { return indexType; }
    public void setIndexType(String indexType) { this.indexType = indexType; }
    public String getMetric() { return metric; }
    public void setMetric(String metric) { this.metric = metric; }
}
