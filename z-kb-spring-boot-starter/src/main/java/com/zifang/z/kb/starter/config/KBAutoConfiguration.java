package com.zifang.z.***REMOVED***.starter.config;

import com.zifang.z.***REMOVED***.api.ChunkVectorStore;
import com.zifang.z.***REMOVED***.api.DocumentRepository;
import com.zifang.z.***REMOVED***.api.EmbeddingProvider;
import com.zifang.z.***REMOVED***.api.***REMOVED***Metrics;
import com.zifang.z.***REMOVED***.api.KnowledgeBaseService;
import com.zifang.z.***REMOVED***.api.KnowledgeGraphStore;
import com.zifang.z.***REMOVED***.api.SearchService;
import com.zifang.z.***REMOVED***.core.chunker.Chunker;
import com.zifang.z.***REMOVED***.core.embedding.HttpEmbeddingProvider;
import com.zifang.z.***REMOVED***.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.***REMOVED***.core.extractor.EntityExtractor;
import com.zifang.z.***REMOVED***.core.extractor.RelationExtractor;
import com.zifang.z.***REMOVED***.core.parser.MarkdownParser;
import com.zifang.z.***REMOVED***.core.search.Bm25Searcher;
import com.zifang.z.***REMOVED***.core.search.HybridSearcher;
import com.zifang.z.***REMOVED***.starter.metrics.Micrometer***REMOVED***Metrics;
import com.zifang.z.***REMOVED***.starter.service.DefaultChatService;
import com.zifang.z.***REMOVED***.starter.service.DefaultKnowledgeBaseService;
import com.zifang.z.***REMOVED***.starter.service.DefaultSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * z-***REMOVED*** Spring Boot 自动装配 — 协调所有子模块的 Bean。
 */
@AutoConfiguration
@ConditionalOnClass(KnowledgeBaseService.class)
@ConditionalOnProperty(prefix = "***REMOVED***", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(***REMOVED***Properties.class)
public class ***REMOVED***AutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(***REMOVED***AutoConfiguration.class);

    // ==================== Parser / Chunker / Extractor ====================

    @Bean
    @ConditionalOnMissingBean(MarkdownParser.class)
    public MarkdownParser markdownParser() {
        return new MarkdownParser();
    }

    @Bean
    @ConditionalOnMissingBean(Chunker.class)
    public Chunker chunker(***REMOVED***Properties props) {
        ***REMOVED***Properties.Chunker cp = props.getChunker();
        return new Chunker(cp.getMaxTokens(), cp.getOverlapTokens(), cp.getMinTokens(),
                com.zifang.z.***REMOVED***.api.TokenEstimator.DEFAULT);
    }

    @Bean
    @ConditionalOnMissingBean(EntityExtractor.class)
    public EntityExtractor entityExtractor() {
        return new EntityExtractor();
    }

    @Bean
    @ConditionalOnMissingBean(RelationExtractor.class)
    public RelationExtractor relationExtractor() {
        return new RelationExtractor();
    }

    @Bean
    @ConditionalOnMissingBean(Bm25Searcher.class)
    public Bm25Searcher bm25Searcher() {
        return new Bm25Searcher();
    }

    @Bean
    @ConditionalOnMissingBean(HybridSearcher.class)
    public HybridSearcher hybridSearcher(ChunkVectorStore vectorStore,
                                          KnowledgeGraphStore graphStore,
                                          Bm25Searcher bm25Searcher,
                                          EmbeddingProvider embeddingProvider,
                                          EntityExtractor entityExtractor,
                                        ObjectProvider<DocumentRepository> documentRepositoryProvider) {
        return new HybridSearcher(vectorStore, graphStore, bm25Searcher, embeddingProvider, entityExtractor,
                documentRepositoryProvider.getIfAvailable());
    }

    // ==================== Embedding ====================

    @Bean
    @ConditionalOnMissingBean(EmbeddingProvider.class)
    public EmbeddingProvider embeddingProvider(***REMOVED***Properties props) {
        ***REMOVED***Properties.Embedding ep = props.getEmbedding();
        if ("http".equalsIgnoreCase(ep.getProvider()) && ep.getEndpoint() != null) {
            log.info("z-***REMOVED*** using HTTP embedding: {} ({})", ep.getModel(), ep.getEndpoint());
            return new HttpEmbeddingProvider(ep.getEndpoint(), ep.getModel(), ep.getApiKey(), ep.getDimension());
        }
        log.info("z-***REMOVED*** using TF-IDF embedding (dimension={})", ep.getDimension());
        return new TfIdfEmbeddingProvider(ep.getDimension());
    }

    // ==================== Metrics ====================

    /**
     * 只有容器里真带 actuator（micrometer 在 classpath）才装配，否则整个 z-***REMOVED*** 都不产生指标，
     * 但功能不受影响 —— 埋点不该成为接入前提。
     */
    // 必须放在嵌套类里：micrometer 是 optional 依赖，若把 @Bean 方法挂在 ***REMOVED***AutoConfiguration 上，
    // 外层解析方法签名时会反射加载 MeterRegistry，下游没带 actuator 就整类加载失败。
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "io.micrometer.core.instrument.MeterRegistry")
    static class MetricsConfiguration {

        @Bean
        @ConditionalOnMissingBean(***REMOVED***Metrics.class)
        ***REMOVED***Metrics ***REMOVED***Metrics(ObjectProvider<MeterRegistry> registryProvider) {
            MeterRegistry registry = registryProvider.getIfAvailable();
            if (registry == null) {
                return null;
            }
            log.info("z-***REMOVED*** metrics enabled (registry: {})", registry.getClass().getSimpleName());
            return new Micrometer***REMOVED***Metrics(registry);
        }
    }

    // ==================== Search ====================

    @Bean
    @ConditionalOnMissingBean(SearchService.class)
    public SearchService searchService(ChunkVectorStore vectorStore,
                                        KnowledgeGraphStore graphStore,
                                        Bm25Searcher bm25Searcher,
                                        EmbeddingProvider embeddingProvider,
                                        EntityExtractor entityExtractor,
                                        ObjectProvider<DocumentRepository> documentRepositoryProvider,
                                        ObjectProvider<***REMOVED***Metrics> metricsProvider) {
        HybridSearcher hybridSearcher = new HybridSearcher(
                vectorStore, graphStore, bm25Searcher, embeddingProvider, entityExtractor,
                documentRepositoryProvider.getIfAvailable());
        return new DefaultSearchService(hybridSearcher, metricsProvider.getIfAvailable());
    }

    // ==================== Main ***REMOVED*** Service ====================

    @Bean
    @ConditionalOnMissingBean(KnowledgeBaseService.class)
    public KnowledgeBaseService knowledgeBaseService(MarkdownParser parser,
                                                      Chunker chunker,
                                                      EntityExtractor entityExtractor,
                                                      RelationExtractor relationExtractor,
                                                      EmbeddingProvider embeddingProvider,
                                                      ChunkVectorStore vectorStore,
                                                      KnowledgeGraphStore graphStore,
                                                      DocumentRepository documentRepository,
                                                      Bm25Searcher bm25Searcher,
                                                      ObjectProvider<***REMOVED***Metrics> metricsProvider) {
        DefaultKnowledgeBaseService svc = new DefaultKnowledgeBaseService(
                parser, chunker, entityExtractor, relationExtractor,
                embeddingProvider, vectorStore, graphStore, documentRepository, bm25Searcher,
                metricsProvider.getIfAvailable());
        log.info("z-***REMOVED*** KnowledgeBaseService initialized");
        return svc;
    }

    @Bean
    @ConditionalOnMissingBean(DefaultChatService.class)
    public DefaultChatService chatService(KnowledgeBaseService ***REMOVED***Service,
                                            SearchService searchService,
                                            ***REMOVED***Properties props,
                                            ObjectProvider<***REMOVED***Metrics> metricsProvider) {
        return new DefaultChatService(***REMOVED***Service, searchService, props.getChat(),
                metricsProvider.getIfAvailable());
    }
}
