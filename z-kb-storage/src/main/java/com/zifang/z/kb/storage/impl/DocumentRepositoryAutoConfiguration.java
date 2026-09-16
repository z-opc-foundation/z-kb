package com.zifang.z.***REMOVED***.storage.impl;

import com.zifang.z.***REMOVED***.api.DocumentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * z-***REMOVED***-storage 自动装配 — 提供默认 JsonFileDocumentRepository（持久化到磁盘）。
 *
 * <p>生产环境可自定义基于 MyBatis-Plus + MySQL 的 Repository，
 * 只需注册一个 DocumentRepository Bean 即可覆盖。
 */
@Configuration
public class DocumentRepositoryAutoConfiguration {

    /**
     * 默认 Bean — JSON 文件持久化（重启不丢数据）。
     * 配置项 {@code z***REMOVED***.storage.path} 可指定存储路径，默认 {@code ~/.z***REMOVED***/z***REMOVED***.json}。
     */
    @Bean
    @ConditionalOnMissingBean(DocumentRepository.class)
    public DocumentRepository documentRepository(
            @Value("${z***REMOVED***.storage.path:#{null}}") String path) {
        if (path == null || path.isEmpty()) {
            return new JsonFileDocumentRepository();
        }
        return new JsonFileDocumentRepository(path);
    }
}