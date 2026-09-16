package com.zifang.z.kb.vector.autoconfigure;

import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.vector.impl.ZVectorChunkVectorStore;
import com.zifang.z.vector.api.DistanceMetric;
import com.zifang.z.vector.api.IndexType;
import com.zifang.z.vector.api.VectorStore;
import com.zifang.z.vector.core.InMemoryVectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * z-kb-vector Spring Boot 自动装配。
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
@ConditionalOnClass(VectorStore.class)
@EnableConfigurationProperties(ChunkVectorStoreProperties.class)
public class ChunkVectorStoreAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ChunkVectorStoreAutoConfiguration.class);

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(VectorStore.class)
    public VectorStore vectorStore(ChunkVectorStoreProperties props) {
        log.info("z-kb initializing z-vector: storage-type={}, data-dir={}",
                props.getStorageType(), props.getDataDir());
        if ("persistent".equalsIgnoreCase(props.getStorageType())) {
            try {
                Class<?> clazz = Class.forName("com.zifang.z.vector.storage.PersistentVectorStore");
                return (VectorStore) clazz.getDeclaredConstructor(String.class)
                        .newInstance(props.getDataDir());
            } catch (Exception e) {
                log.warn("PersistentVectorStore unavailable, fallback to in-memory: {}", e.getMessage());
            }
        }
        return new InMemoryVectorStore();
    }

    @Bean
    @ConditionalOnMissingBean(ChunkVectorStore.class)
    public ChunkVectorStore chunkVectorStore(VectorStore vectorStore,
                                              ChunkVectorStoreProperties props,
                                              @Autowired(required = false) EmbeddingProvider embeddingProvider) {
        int dim = props.getDimension();
        if (embeddingProvider != null) dim = embeddingProvider.dimension();
        return new ZVectorChunkVectorStore(vectorStore, dim);
    }
}
