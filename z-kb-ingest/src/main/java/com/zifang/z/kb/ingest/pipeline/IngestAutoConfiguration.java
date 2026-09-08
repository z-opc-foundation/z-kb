package com.zifang.z.kb.ingest.pipeline;

import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.ingest.source.WebhookSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ingest 模块的 Spring 自动装配。
 */
@Configuration
public class IngestAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(IngestAutoConfiguration.class);

    @Bean
    @ConditionalOnMissingBean
    public DataSourceRegistry dataSourceRegistry(@Autowired(required = false) java.util.List<com.zifang.z.kb.ingest.api.DataSource> beans) {
        DataSourceRegistry registry = new DataSourceRegistry();
        registry.installDefaults();
        if (beans != null) {
            for (var s : beans) registry.register(s);
        }
        log.info("DataSourceRegistry 初始化完成，内置 9 种数据源");
        return registry;
    }

    @Bean
    @ConditionalOnMissingBean
    public IngestPipeline ingestPipeline(KnowledgeBaseService kbService, DataSourceRegistry registry) {
        log.info("IngestPipeline 创建完成");
        return new IngestPipeline(kbService, registry);
    }

    @Bean
    @ConditionalOnMissingBean(name = "webhookSource")
    public WebhookSource webhookSource() {
        return new WebhookSource("webhook-default");
    }
}