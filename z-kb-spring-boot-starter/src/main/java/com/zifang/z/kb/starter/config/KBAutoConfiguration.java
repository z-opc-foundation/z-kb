package com.zifang.z.kb.starter.config;

import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.chunker.Chunker;
import com.zifang.z.kb.core.embedding.HttpEmbeddingProvider;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.extractor.RelationExtractor;
import com.zifang.z.kb.core.parser.MarkdownParser;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;
import com.zifang.z.kb.starter.service.DefaultChatService;
import com.zifang.z.kb.starter.service.DefaultKnowledgeBaseService;
import com.zifang.z.kb.starter.service.DefaultSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * z-kb Spring Boot 自动装配 — 协调所有子模块的 Bean。
 */
@AutoConfiguration
@ConditionalOnClass(KnowledgeBaseService.class)
@ConditionalOnProperty(prefix = "zkb", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(KBProperties.class)
public class KBAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(KBAutoConfiguration.class);

    // ==================== Parser / Chunker / Extractor ====================

    @Bean
    @ConditionalOnMissingBean(MarkdownParser.class)
    public MarkdownParser markdownParser() {
        return new MarkdownParser();
    }

    @Bean
    @ConditionalOnMissingBean(Chunker.class)
    public Chunker chunker(KBProperties props) {
        KBProperties.Chunker cp = props.getChunker();
        return new Chunker(cp.getMaxTokens(), cp.getOverlapTokens(), cp.getMinTokens(),
                com.zifang.z.kb.api.TokenEstimator.DEFAULT);
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
                                          EntityExtractor entityExtractor) {
        return new HybridSearcher(vectorStore, graphStore, bm25Searcher, embeddingProvider, entityExtractor);
    }

    // ==================== Embedding ====================

    @Bean
    @ConditionalOnMissingBean(EmbeddingProvider.class)
    public EmbeddingProvider embeddingProvider(KBProperties props) {
        KBProperties.Embedding ep = props.getEmbedding();
        if ("http".equalsIgnoreCase(ep.getProvider()) && ep.getEndpoint() != null) {
            log.info("z-kb using HTTP embedding: {} ({})", ep.getModel(), ep.getEndpoint());
            return new HttpEmbeddingProvider(ep.getEndpoint(), ep.getModel(), ep.getApiKey(), ep.getDimension());
        }
        log.info("z-kb using TF-IDF embedding (dimension={})", ep.getDimension());
        return new TfIdfEmbeddingProvider(ep.getDimension());
    }

    // ==================== Search ====================

    @Bean
    @ConditionalOnMissingBean(SearchService.class)
    public SearchService searchService(ChunkVectorStore vectorStore,
                                        KnowledgeGraphStore graphStore,
                                        Bm25Searcher bm25Searcher,
                                        EmbeddingProvider embeddingProvider,
                                        EntityExtractor entityExtractor) {
        HybridSearcher hybridSearcher = new HybridSearcher(
                vectorStore, graphStore, bm25Searcher, embeddingProvider, entityExtractor);
        return new DefaultSearchService(hybridSearcher);
    }

    // ==================== Main KB Service ====================

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
                                                      Bm25Searcher bm25Searcher) {
        DefaultKnowledgeBaseService svc = new DefaultKnowledgeBaseService(
                parser, chunker, entityExtractor, relationExtractor,
                embeddingProvider, vectorStore, graphStore, documentRepository, bm25Searcher);
        log.info("z-kb KnowledgeBaseService initialized");
        return svc;
    }

    @Bean
    @ConditionalOnMissingBean(DefaultChatService.class)
    public DefaultChatService chatService(KnowledgeBaseService kbService,
                                            SearchService searchService,
                                            KBProperties props) {
        return new DefaultChatService(kbService, searchService, props.getChat());
    }
}
