package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.KbPaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 *
 * <p><b>1.1.0</b>：路径约定化 —— {@code zkb.storage.path} 支持 {@code ~} 展开，
 * 默认 {@code ~/.zkb/zkb.json}（D3 拍板：文档仓库仍默认 JSON 持久化）。
 */
@Configuration
public class DocumentRepositoryAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(DocumentRepositoryAutoConfiguration.class);

    /**
     * 默认 Bean — JSON 文件持久化（重启不丢数据）。
     * 配置项 {@code zkb.storage.path} 可指定存储路径，默认 {@code ~/.zkb/zkb.json}。
     */
    @Bean
    @ConditionalOnMissingBean(DocumentRepository.class)
    public DocumentRepository documentRepository(
            @Value("${zkb.storage.path:#{null}}") String path) {
        String resolved = (path == null || path.trim().isEmpty())
                ? KbPaths.documentFile() : KbPaths.expand(path);
        DocumentRepository repository = new JsonFileDocumentRepository(resolved);
        log.info("z-kb 文档仓库后端：{}（path={}）",
                repository.getClass().getName(), resolved);
        return repository;
    }
}
