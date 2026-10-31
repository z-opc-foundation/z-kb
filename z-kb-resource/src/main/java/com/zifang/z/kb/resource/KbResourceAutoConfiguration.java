package com.zifang.z.kb.resource;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.kb.api.material.KbMaterialParser;
import com.zifang.z.kb.api.material.KbOriginalFileStore;
import com.zifang.z.kb.api.material.MaterialCategoryService;
import com.zifang.z.kb.api.material.MaterialRepoBrowseService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.compilation.CompilationBatchService;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.audit.AuditLogService;
import com.zifang.z.kb.api.concept.ConceptService;
import com.zifang.z.kb.api.extraction.ExtractionService;
import com.zifang.z.kb.api.graph.GraphService;
import com.zifang.z.kb.api.overview.OverviewService;
import com.zifang.z.kb.api.overview.WikiPageCounter;
import com.zifang.z.kb.api.resource.KbPrincipalDirectory;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.source.IngestService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceService;
import com.zifang.z.kb.api.taskconfig.KbTaskConfigService;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorService;
import com.zifang.z.kb.api.wiki.WikiService;
import com.zifang.z.kb.core.extraction.ExtractionEngine;
import com.zifang.z.kb.core.source.git.GitApiClient;
import com.zifang.z.kb.core.source.yuque.YuqueApiClient;
import com.zifang.z.kb.core.source.yuque.YuqueDocReader;
import com.zifang.z.kb.resource.compilation.CompilationStageRunner;
import com.zifang.z.kb.resource.compilation.DefaultCompilationBatchService;
import com.zifang.z.kb.resource.compilation.DefaultCompilationService;
import com.zifang.z.kb.resource.material.DefaultKbMaterialParser;
import com.zifang.z.kb.resource.material.DefaultMaterialCategoryService;
import com.zifang.z.kb.resource.material.DefaultMaterialRepoBrowseService;
import com.zifang.z.kb.resource.material.DefaultMaterialService;
import com.zifang.z.kb.resource.material.LocalKbOriginalFileStore;
import com.zifang.z.kb.resource.ops.DefaultAuditLogService;
import com.zifang.z.kb.resource.ops.DefaultConceptService;
import com.zifang.z.kb.resource.ops.DefaultExtractionService;
import com.zifang.z.kb.resource.ops.DefaultGraphService;
import com.zifang.z.kb.resource.ops.DefaultKbTaskConfigService;
import com.zifang.z.kb.resource.ops.DefaultOverviewService;
import com.zifang.z.kb.resource.ops.DefaultTaskConfigService;
import com.zifang.z.kb.resource.ops.DefaultTaskMonitorService;
import com.zifang.z.kb.resource.ops.DefaultWikiPageCounter;
import com.zifang.z.kb.resource.ops.DefaultWikiService;
import com.zifang.z.kb.resource.retrieval.DefaultKnowledgeRetrievalService;
import com.zifang.z.kb.resource.source.DefaultIngestService;
import com.zifang.z.kb.resource.source.DefaultKnowledgeBaseSourceService;
import com.zifang.z.kb.resource.source.DocIngestRunner;
import com.zifang.z.kb.resource.source.GitIngestConnector;
import com.zifang.z.kb.resource.source.IngestConnector;
import com.zifang.z.kb.resource.source.SourceTreeNodes;
import com.zifang.z.kb.resource.source.YuqueIngestConnector;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.compilation.mapper.CompilationStageMapper;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMapper;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMentionMapper;
import com.zifang.z.kb.storage.extraction.mapper.ExtractionItemMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphEdgeMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import com.zifang.z.kb.storage.material.mapper.MaterialCategoryMapper;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;
import com.zifang.z.kb.storage.material.mapper.MaterialVersionMapper;
import com.zifang.z.kb.storage.material.mapper.ParsedDraftMapper;
import com.zifang.z.kb.storage.resource.KbResourcePersistenceAutoConfiguration;
import com.zifang.z.kb.storage.resource.mapper.KbAuditLogMapper;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseAclMapper;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseMapper;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileVersionMapper;
import com.zifang.z.kb.storage.taskconfig.mapper.TaskConfigMapper;
import com.zifang.z.kb.storage.wiki.mapper.WikiDocMapper;
import com.zifang.z.kb.storage.wiki.mapper.WikiPageMapper;
import com.zifang.z.kb.storage.wiki.mapper.WikiPageSourceMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;
import java.util.List;

/**
 * 资源域装配：知识库生命周期、成员 ACL、配置版本与审计。
 *
 * <p>条件与 {@link KbResourcePersistenceAutoConfiguration} 同口径（DataSource + 开关），
 * 不写成 {@code @ConditionalOnBean(Mapper.class)}：Mapper 由同族的 {@code @MapperScan} 注册，
 * 注册时机晚于自动配置条件求值，按 Bean 判会恒不成立。</p>
 */
@AutoConfiguration(after = KbResourcePersistenceAutoConfiguration.class)
@ConditionalOnClass({DataSource.class, BaseMapper.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "zkb.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
public class KbResourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public KbPrincipalDirectory kbPrincipalDirectory() {
        return new EmptyKbPrincipalDirectory();
    }

    @Bean
    @ConditionalOnMissingBean
    public KbAuditService kbAuditService(KbAuditLogMapper auditLogMapper) {
        return new KbAuditService(auditLogMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseResourceService knowledgeBaseResourceService(
            KnowledgeBaseMapper kbMapper,
            KnowledgeBaseAclMapper aclMapper,
            KnowledgeBaseProfileMapper profileMapper,
            KnowledgeBaseProfileVersionMapper versionMapper,
            KbAuditService auditService) {
        return new DefaultKnowledgeBaseResourceService(kbMapper, aclMapper, profileMapper,
                versionMapper, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseMemberAdminService knowledgeBaseMemberAdminService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseAclMapper aclMapper,
            KbPrincipalDirectory principalDirectory,
            KbAuditService auditService) {
        return new DefaultKnowledgeBaseMemberAdminService(resourceService, aclMapper,
                principalDirectory, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseConfigService knowledgeBaseConfigService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper,
            KnowledgeBaseProfileVersionMapper versionMapper,
            KbAuditService auditService) {
        return new DefaultKnowledgeBaseConfigService(resourceService, profileMapper,
                versionMapper, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public KbOriginalFileStore kbOriginalFileStore(
            @Value("${zkb.material.storage.root:}") String rootDir) {
        return new LocalKbOriginalFileStore(rootDir);
    }

    @Bean
    @ConditionalOnMissingBean
    public KbMaterialParser defaultKbMaterialParser() {
        return new DefaultKbMaterialParser();
    }

    @Bean
    @ConditionalOnMissingBean
    public MaterialService materialService(
            MaterialMapper materialMapper,
            MaterialVersionMapper versionMapper,
            ParsedDraftMapper draftMapper,
            MaterialCategoryMapper categoryMapper,
            KnowledgeBaseResourceService resourceService,
            KbOriginalFileStore fileStore,
            List<KbMaterialParser> parsers) {
        return new DefaultMaterialService(materialMapper, versionMapper, draftMapper,
                categoryMapper, resourceService, fileStore, parsers);
    }

    @Bean
    @ConditionalOnMissingBean
    public MaterialCategoryService materialCategoryService(
            MaterialCategoryMapper categoryMapper,
            MaterialMapper materialMapper,
            KnowledgeBaseResourceService resourceService) {
        return new DefaultMaterialCategoryService(categoryMapper, materialMapper, resourceService);
    }

    @Bean
    @ConditionalOnMissingBean
    public MaterialRepoBrowseService materialRepoBrowseService(
            MaterialService materialService,
            @Value("${zkb.material.repo.root:}") String repoRoot) {
        return new DefaultMaterialRepoBrowseService(materialService, repoRoot);
    }

    @Bean
    @ConditionalOnMissingBean
    public ExtractionEngine extractionEngine() {
        return new ExtractionEngine();
    }

    @Bean
    @ConditionalOnMissingBean
    public ExtractionService extractionService(ExtractionEngine extractionEngine,
                                               ExtractionItemMapper extractionItemMapper,
                                               ConceptMapper conceptMapper,
                                               ConceptMentionMapper conceptMentionMapper,
                                               GraphNodeMapper graphNodeMapper,
                                               GraphEdgeMapper graphEdgeMapper,
                                               CompilationStageMapper compilationStageMapper,
                                               MaterialService materialService) {
        return new DefaultExtractionService(extractionEngine, extractionItemMapper, conceptMapper,
                conceptMentionMapper, graphNodeMapper, graphEdgeMapper, compilationStageMapper,
                materialService);
    }

    @Bean
    @ConditionalOnMissingBean
    public ConceptService conceptService(ConceptMapper conceptMapper,
                                         ConceptMentionMapper conceptMentionMapper,
                                         KnowledgeBaseResourceService resourceService) {
        return new DefaultConceptService(conceptMapper, conceptMentionMapper, resourceService);
    }

    @Bean
    @ConditionalOnMissingBean
    public GraphService graphService(GraphNodeMapper graphNodeMapper,
                                     GraphEdgeMapper graphEdgeMapper,
                                     KnowledgeBaseResourceService resourceService,
                                     MaterialService materialService) {
        return new DefaultGraphService(graphNodeMapper, graphEdgeMapper, resourceService,
                materialService);
    }

    @Bean
    @ConditionalOnMissingBean
    public CompilationStageRunner compilationStageRunner(
            ArtifactMapper artifactMapper,
            ArtifactVersionMapper artifactVersionMapper,
            RetrievalChunkMapper retrievalChunkMapper,
            ExtractionService extractionService) {
        return new CompilationStageRunner(artifactMapper, artifactVersionMapper,
                retrievalChunkMapper, extractionService);
    }

    @Bean
    @ConditionalOnMissingBean
    public CompilationService compilationService(
            CompilationJobMapper compilationJobMapper,
            CompilationStageMapper compilationStageMapper,
            ArtifactMapper artifactMapper,
            ArtifactVersionMapper artifactVersionMapper,
            RetrievalChunkMapper retrievalChunkMapper,
            MaterialService materialService,
            KnowledgeBaseResourceService resourceService,
            CompilationStageRunner compilationStageRunner) {
        return new DefaultCompilationService(compilationJobMapper, compilationStageMapper,
                artifactMapper, artifactVersionMapper, retrievalChunkMapper, materialService,
                resourceService, compilationStageRunner);
    }

    @Bean
    @ConditionalOnMissingBean
    public CompilationBatchService compilationBatchService(
            CompilationJobMapper compilationJobMapper,
            CompilationStageMapper compilationStageMapper,
            CompilationService compilationService,
            MaterialService materialService,
            KnowledgeBaseResourceService resourceService,
            KbPrincipalDirectory principalDirectory) {
        return new DefaultCompilationBatchService(compilationJobMapper, compilationStageMapper,
                compilationService, materialService, resourceService, principalDirectory);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeRetrievalService knowledgeRetrievalService(
            KnowledgeBaseResourceService resourceService,
            RetrievalChunkMapper retrievalChunkMapper,
            MaterialMapper materialMapper) {
        return new DefaultKnowledgeRetrievalService(resourceService, retrievalChunkMapper,
                materialMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public AuditLogService auditLogService(KbAuditLogMapper auditLogMapper) {
        return new DefaultAuditLogService(auditLogMapper);
    }

    @Bean
    @ConditionalOnMissingBean(DefaultTaskConfigService.class)
    public DefaultTaskConfigService taskConfigService(TaskConfigMapper taskConfigMapper) {
        return new DefaultTaskConfigService(taskConfigMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public KbTaskConfigService kbTaskConfigService(TaskConfigMapper taskConfigMapper,
                                                   DefaultTaskConfigService tenantConfigService,
                                                   KnowledgeBaseResourceService resourceService,
                                                   KbAuditService auditService) {
        return new DefaultKbTaskConfigService(taskConfigMapper, tenantConfigService,
                resourceService, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public TaskMonitorService taskMonitorService(CompilationJobMapper compilationJobMapper,
                                                 CompilationStageMapper compilationStageMapper,
                                                 KnowledgeBaseResourceService resourceService) {
        return new DefaultTaskMonitorService(compilationJobMapper, compilationStageMapper,
                resourceService);
    }

    @Bean
    @ConditionalOnMissingBean
    public WikiService wikiService(WikiPageMapper wikiPageMapper,
                                   WikiPageSourceMapper wikiPageSourceMapper,
                                   WikiDocMapper wikiDocMapper,
                                   ArtifactMapper artifactMapper,
                                   ArtifactVersionMapper artifactVersionMapper,
                                   MaterialService materialService,
                                   KnowledgeBaseResourceService resourceService,
                                   GraphNodeMapper graphNodeMapper,
                                   GraphEdgeMapper graphEdgeMapper) {
        return new DefaultWikiService(wikiPageMapper, wikiPageSourceMapper, wikiDocMapper,
                artifactMapper, artifactVersionMapper, materialService, resourceService,
                graphNodeMapper, graphEdgeMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public WikiPageCounter wikiPageCounter(WikiPageMapper wikiPageMapper) {
        return new DefaultWikiPageCounter(wikiPageMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public OverviewService overviewService(KnowledgeBaseResourceService resourceService,
                                           MaterialService materialService,
                                           MaterialMapper materialMapper,
                                           CompilationJobMapper compilationJobMapper,
                                           ObjectProvider<WikiPageCounter> wikiPageCounters) {
        return new DefaultOverviewService(resourceService, materialService, materialMapper,
                compilationJobMapper, wikiPageCounters.orderedStream().toList());
    }

    // ==================== 接入源：适配器 + 同步 ====================

    @Bean
    @ConditionalOnMissingBean
    public YuqueApiClient yuqueApiClient(
            @Value("${zkb.source.yuque.base-url:}") String baseUrl,
            @Value("${zkb.source.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${zkb.source.http.read-timeout-ms:10000}") int readTimeoutMs) {
        return new YuqueApiClient(baseUrl, connectTimeoutMs, readTimeoutMs);
    }

    @Bean
    @ConditionalOnMissingBean
    public YuqueDocReader yuqueDocReader(YuqueApiClient yuqueApiClient) {
        return new YuqueDocReader(yuqueApiClient);
    }

    @Bean
    @ConditionalOnMissingBean
    public GitApiClient gitApiClient(
            @Value("${zkb.source.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${zkb.source.git.read-timeout-ms:20000}") int readTimeoutMs,
            @Value("${zkb.source.git.allowed-hosts:}") String allowedHosts) {
        return new GitApiClient(connectTimeoutMs, readTimeoutMs, allowedHosts);
    }

    @Bean
    @ConditionalOnMissingBean
    public SourceTreeNodes sourceTreeNodes(MaterialCategoryService materialCategoryService) {
        return new SourceTreeNodes(materialCategoryService);
    }

    @Bean
    @ConditionalOnMissingBean
    public DocIngestRunner docIngestRunner(MaterialService materialService) {
        return new DocIngestRunner(materialService);
    }

    @Bean
    @ConditionalOnMissingBean
    public YuqueIngestConnector yuqueIngestConnector(YuqueApiClient yuqueApiClient,
                                                     YuqueDocReader yuqueDocReader,
                                                     DocIngestRunner docIngestRunner,
                                                     SourceTreeNodes sourceTreeNodes) {
        return new YuqueIngestConnector(yuqueApiClient, yuqueDocReader, docIngestRunner,
                sourceTreeNodes);
    }

    @Bean
    @ConditionalOnMissingBean
    public GitIngestConnector gitIngestConnector(GitApiClient gitApiClient,
                                                 MaterialService materialService,
                                                 SourceTreeNodes sourceTreeNodes) {
        return new GitIngestConnector(gitApiClient, materialService, sourceTreeNodes);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseSourceService knowledgeBaseSourceService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper,
            KbAuditService auditService,
            YuqueApiClient yuqueApiClient,
            GitApiClient gitApiClient) {
        return new DefaultKnowledgeBaseSourceService(resourceService, profileMapper, auditService,
                yuqueApiClient, gitApiClient);
    }

    @Bean
    @ConditionalOnMissingBean
    public IngestService ingestService(KnowledgeBaseSourceService sourceService,
                                       List<IngestConnector> connectors,
                                       KbAuditService auditService) {
        return new DefaultIngestService(sourceService, connectors, auditService);
    }
}
