package com.zifang.z.kb.graph.autoconfigure;

import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.graph.impl.JsonFileKnowledgeGraphStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * z-kb-graph Spring Boot 自动装配。
 *
 * <p>默认使用 JSON 文件持久化（重启不丢数据），可通过 {@code zkb.graph.path} 指定位置。
 * 如果想用 z-graph 自带的内存版，可以自行注入 {@link com.zifang.z.kb.graph.impl.ZGraphKnowledgeGraphStore}。
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
public class KnowledgeGraphStoreAutoConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(KnowledgeGraphStore.class)
    public KnowledgeGraphStore knowledgeGraphStore(
            @Value("${zkb.graph.path:#{null}}") String path) {
        if (path == null || path.isEmpty()) {
            return new JsonFileKnowledgeGraphStore();
        }
        return new JsonFileKnowledgeGraphStore(path);
    }
}