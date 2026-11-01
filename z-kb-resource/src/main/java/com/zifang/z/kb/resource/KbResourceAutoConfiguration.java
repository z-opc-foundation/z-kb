package com.zifang.z.***REMOVED***.resource;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.***REMOVED***.api.material.***REMOVED***MaterialParser;
import com.zifang.z.***REMOVED***.api.material.***REMOVED***OriginalFileStore;
import com.zifang.z.***REMOVED***.api.material.MaterialCategoryService;
import com.zifang.z.***REMOVED***.api.material.MaterialRepoBrowseService;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.compilation.CompilationBatchService;
import com.zifang.z.***REMOVED***.api.compilation.CompilationService;
import com.zifang.z.***REMOVED***.api.audit.AuditLogService;
import com.zifang.z.***REMOVED***.api.concept.ConceptService;
import com.zifang.z.***REMOVED***.api.extraction.ExtractionService;
import com.zifang.z.***REMOVED***.api.graph.GraphService;
import com.zifang.z.***REMOVED***.api.overview.OverviewService;
import com.zifang.z.***REMOVED***.api.overview.WikiPageCounter;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***PrincipalDirectory;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.***REMOVED***.api.source.IngestService;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceService;
import com.zifang.z.***REMOVED***.api.taskconfig.***REMOVED***TaskConfigService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorService;
import com.zifang.z.***REMOVED***.api.wiki.WikiService;
import com.zifang.z.***REMOVED***.core.extraction.ExtractionEngine;
import com.zifang.z.***REMOVED***.core.source.git.GitApiClient;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueApiClient;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueDocReader;
import com.zifang.z.***REMOVED***.resource.compilation.CompilationStageRunner;
import com.zifang.z.***REMOVED***.resource.compilation.DefaultCompilationBatchService;
import com.zifang.z.***REMOVED***.resource.compilation.DefaultCompilationService;
import com.zifang.z.***REMOVED***.resource.material.Default***REMOVED***MaterialParser;
import com.zifang.z.***REMOVED***.resource.material.DefaultMaterialCategoryService;
import com.zifang.z.***REMOVED***.resource.material.DefaultMaterialRepoBrowseService;
import com.zifang.z.***REMOVED***.resource.material.DefaultMaterialService;
import com.zifang.z.***REMOVED***.resource.material.Local***REMOVED***OriginalFileStore;
import com.zifang.z.***REMOVED***.resource.ops.DefaultAuditLogService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultConceptService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultExtractionService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultGraphService;
import com.zifang.z.***REMOVED***.resource.ops.Default***REMOVED***TaskConfigService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultOverviewService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultTaskConfigService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultTaskMonitorService;
import com.zifang.z.***REMOVED***.resource.ops.DefaultWikiPageCounter;
import com.zifang.z.***REMOVED***.resource.ops.DefaultWikiService;
import com.zifang.z.***REMOVED***.resource.retrieval.DefaultKnowledgeRetrievalService;
import com.zifang.z.***REMOVED***.resource.source.DefaultIngestService;
import com.zifang.z.***REMOVED***.resource.source.DefaultKnowledgeBaseSourceService;
import com.zifang.z.***REMOVED***.resource.source.DocIngestRunner;
import com.zifang.z.***REMOVED***.resource.source.GitIngestConnector;
import com.zifang.z.***REMOVED***.resource.source.IngestConnector;
import com.zifang.z.***REMOVED***.resource.source.LocalIngestConnector;
import com.zifang.z.***REMOVED***.resource.source.SourceTreeNodes;
import com.zifang.z.***REMOVED***.resource.source.YuqueIngestConnector;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.CompilationStageMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.ConceptMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.ConceptMentionMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.ExtractionItemMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.GraphEdgeMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.GraphNodeMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialCategoryMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialVersionMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.ParsedDraftMapper;
import com.zifang.z.***REMOVED***.storage.resource.***REMOVED***ResourcePersistenceAutoConfiguration;
import com.zifang.z.***REMOVED***.storage.resource.mapper.***REMOVED***AuditLogMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseAclMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileVersionMapper;
import com.zifang.z.***REMOVED***.storage.taskconfig.mapper.TaskConfigMapper;
import com.zifang.z.***REMOVED***.storage.wiki.mapper.WikiDocMapper;
import com.zifang.z.***REMOVED***.storage.wiki.mapper.WikiPageMapper;
import com.zifang.z.***REMOVED***.storage.wiki.mapper.WikiPageSourceMapper;
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
 * <p>条件与 {@link ***REMOVED***ResourcePersistenceAutoConfiguration} 同口径（DataSource + 开关），
 * 不写成 {@code @ConditionalOnBean(Mapper.class)}：Mapper 由同族的 {@code @MapperScan} 注册，
 * 注册时机晚于自动配置条件求值，按 Bean 判会恒不成立。</p>
 */
@AutoConfiguration(after = ***REMOVED***ResourcePersistenceAutoConfiguration.class)
@ConditionalOnClass({DataSource.class, BaseMapper.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "z***REMOVED***.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
public class ***REMOVED***ResourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***PrincipalDirectory ***REMOVED***PrincipalDirectory() {
        return new Empty***REMOVED***PrincipalDirectory();
    }

    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***AuditService ***REMOVED***AuditService(***REMOVED***AuditLogMapper auditLogMapper) {
        return new ***REMOVED***AuditService(auditLogMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseResourceService knowledgeBaseResourceService(
            KnowledgeBaseMapper ***REMOVED***Mapper,
            KnowledgeBaseAclMapper aclMapper,
            KnowledgeBaseProfileMapper profileMapper,
            KnowledgeBaseProfileVersionMapper versionMapper,
            ***REMOVED***AuditService auditService) {
        return new DefaultKnowledgeBaseResourceService(***REMOVED***Mapper, aclMapper, profileMapper,
                versionMapper, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseMemberAdminService knowledgeBaseMemberAdminService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseAclMapper aclMapper,
            ***REMOVED***PrincipalDirectory principalDirectory,
            ***REMOVED***AuditService auditService) {
        return new DefaultKnowledgeBaseMemberAdminService(resourceService, aclMapper,
                principalDirectory, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseConfigService knowledgeBaseConfigService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper,
            KnowledgeBaseProfileVersionMapper versionMapper,
            ***REMOVED***AuditService auditService) {
        return new DefaultKnowledgeBaseConfigService(resourceService, profileMapper,
                versionMapper, auditService);
    }

    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***OriginalFileStore ***REMOVED***OriginalFileStore(
            @Value("${z***REMOVED***.material.storage.root:}") String rootDir) {
        return new Local***REMOVED***OriginalFileStore(rootDir);
    }

    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***MaterialParser default***REMOVED***MaterialParser() {
        return new Default***REMOVED***MaterialParser();
    }

    @Bean
    @ConditionalOnMissingBean
    public MaterialService materialService(
            MaterialMapper materialMapper,
            MaterialVersionMapper versionMapper,
            ParsedDraftMapper draftMapper,
            MaterialCategoryMapper categoryMapper,
            KnowledgeBaseResourceService resourceService,
            ***REMOVED***OriginalFileStore fileStore,
            List<***REMOVED***MaterialParser> parsers) {
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
            @Value("${z***REMOVED***.material.repo.root:}") String repoRoot) {
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
            ***REMOVED***PrincipalDirectory principalDirectory) {
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
    public AuditLogService auditLogService(***REMOVED***AuditLogMapper auditLogMapper) {
        return new DefaultAuditLogService(auditLogMapper);
    }

    @Bean
    @ConditionalOnMissingBean(DefaultTaskConfigService.class)
    public DefaultTaskConfigService taskConfigService(TaskConfigMapper taskConfigMapper) {
        return new DefaultTaskConfigService(taskConfigMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***TaskConfigService ***REMOVED***TaskConfigService(TaskConfigMapper taskConfigMapper,
                                                   DefaultTaskConfigService tenantConfigService,
                                                   KnowledgeBaseResourceService resourceService,
                                                   ***REMOVED***AuditService auditService) {
        return new Default***REMOVED***TaskConfigService(taskConfigMapper, tenantConfigService,
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
            @Value("${z***REMOVED***.source.yuque.base-url:}") String baseUrl,
            @Value("${z***REMOVED***.source.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${z***REMOVED***.source.http.read-timeout-ms:10000}") int readTimeoutMs) {
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
            @Value("${z***REMOVED***.source.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${z***REMOVED***.source.git.read-timeout-ms:20000}") int readTimeoutMs,
            @Value("${z***REMOVED***.source.git.allowed-hosts:}") String allowedHosts) {
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
    public LocalIngestConnector localIngestConnector(DocIngestRunner docIngestRunner,
                                                     SourceTreeNodes sourceTreeNodes) {
        return new LocalIngestConnector(docIngestRunner, sourceTreeNodes);
    }

    @Bean
    @ConditionalOnMissingBean
    public KnowledgeBaseSourceService knowledgeBaseSourceService(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper,
            ***REMOVED***AuditService auditService,
            YuqueApiClient yuqueApiClient,
            GitApiClient gitApiClient) {
        return new DefaultKnowledgeBaseSourceService(resourceService, profileMapper, auditService,
                yuqueApiClient, gitApiClient);
    }

    @Bean
    @ConditionalOnMissingBean
    public IngestService ingestService(KnowledgeBaseSourceService sourceService,
                                       List<IngestConnector> connectors,
                                       ***REMOVED***AuditService auditService) {
        return new DefaultIngestService(sourceService, connectors, auditService);
    }
}
