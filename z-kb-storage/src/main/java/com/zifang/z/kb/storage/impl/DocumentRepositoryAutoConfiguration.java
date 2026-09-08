package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.DocumentRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * z-kb-storage 自动装配 — 提供默认 in-memory DocumentRepository。
 *
 * <p>生产环境可自定义基于 MyBatis-Plus + MySQL 的 Repository，
 * 只需注册一个 DocumentRepository Bean 即可覆盖。
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
public class DocumentRepositoryAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(DocumentRepository.class)
    public DocumentRepository documentRepository() {
        return new InMemoryDocumentRepository();
    }
}
