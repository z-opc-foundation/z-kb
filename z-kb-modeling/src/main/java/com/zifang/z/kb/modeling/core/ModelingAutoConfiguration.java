package com.zifang.z.***REMOVED***.modeling.core;

import com.zifang.z.***REMOVED***.api.KnowledgeBaseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Modeling 模块的 Spring 自动装配。
 */
@Configuration
public class ModelingAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ModelingAutoConfiguration.class);

    @Bean
    @ConditionalOnMissingBean
    public ModelingService modelingService(KnowledgeBaseService ***REMOVED***Service) {
        log.info("ModelingService 初始化");
        return new ModelingService(***REMOVED***Service);
    }
}