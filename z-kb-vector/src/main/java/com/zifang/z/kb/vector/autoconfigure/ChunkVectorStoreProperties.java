package com.zifang.z.kb.vector.autoconfigure;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * z-kb-vector 配置属性。
 */
@ConfigurationProperties(prefix = "zkb.vector")
public class ChunkVectorStoreProperties {

    private String storageType = "in-memory"; // in-memory / persistent
    private String dataDir = "./data/zvector";
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
