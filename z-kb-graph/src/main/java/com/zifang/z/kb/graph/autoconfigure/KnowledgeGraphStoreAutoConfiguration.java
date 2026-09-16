package com.zifang.z.***REMOVED***.graph.autoconfigure;

import com.zifang.z.***REMOVED***.api.KnowledgeGraphStore;
import com.zifang.z.***REMOVED***.graph.impl.JsonFileKnowledgeGraphStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * z-***REMOVED***-graph Spring Boot 自动装配。
 *
 * <p>默认使用 JSON 文件持久化（重启不丢数据），可通过 {@code z***REMOVED***.graph.path} 指定位置。
 * 如果想用 z-graph 自带的内存版，可以自行注入 {@link com.zifang.z.***REMOVED***.graph.impl.ZGraphKnowledgeGraphStore}。
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
public class KnowledgeGraphStoreAutoConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(KnowledgeGraphStore.class)
    public KnowledgeGraphStore knowledgeGraphStore(
            @Value("${z***REMOVED***.graph.path:#{null}}") String path) {
        if (path == null || path.isEmpty()) {
            return new JsonFileKnowledgeGraphStore();
        }
        return new JsonFileKnowledgeGraphStore(path);
    }
}