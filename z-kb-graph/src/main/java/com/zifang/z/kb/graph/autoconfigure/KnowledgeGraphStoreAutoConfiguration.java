package com.zifang.z.kb.graph.autoconfigure;

import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.graph.impl.ZGraphKnowledgeGraphStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * z-kb-graph Spring Boot 自动装配。
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
public class KnowledgeGraphStoreAutoConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(KnowledgeGraphStore.class)
    public KnowledgeGraphStore knowledgeGraphStore() {
        return new ZGraphKnowledgeGraphStore();
    }
}
