package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.DocumentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * z-kb-storage 自动装配 — 提供默认 JsonFileDocumentRepository（持久化到磁盘）。
 *
 * <p>生产环境可自定义基于 MyBatis-Plus + MySQL 的 Repository，
 * 只需注册一个 DocumentRepository Bean 即可覆盖。
 */
@Configuration
public class DocumentRepositoryAutoConfiguration {

    /**
     * 默认 Bean — JSON 文件持久化（重启不丢数据）。
     * 配置项 {@code zkb.storage.path} 可指定存储路径，默认 {@code ~/.zkb/zkb.json}。
     */
    @Bean
    @ConditionalOnMissingBean(DocumentRepository.class)
    public DocumentRepository documentRepository(
            @Value("${zkb.storage.path:#{null}}") String path) {
        if (path == null || path.isEmpty()) {
            return new JsonFileDocumentRepository();
        }
        return new JsonFileDocumentRepository(path);
    }
}