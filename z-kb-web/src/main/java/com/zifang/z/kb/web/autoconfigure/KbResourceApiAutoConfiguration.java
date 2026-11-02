package com.zifang.z.kb.web.autoconfigure;

import com.zifang.z.kb.api.audit.AuditLogService;
import com.zifang.z.kb.api.compilation.CompilationBatchService;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.concept.ConceptService;
import com.zifang.z.kb.api.evaluation.EvaluationService;
import com.zifang.z.kb.api.extraction.ExtractionService;
import com.zifang.z.kb.api.graph.GraphService;
import com.zifang.z.kb.api.material.MaterialCategoryService;
import com.zifang.z.kb.api.material.MaterialRepoBrowseService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.overview.OverviewService;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.source.IngestService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceService;
import com.zifang.z.kb.api.taskconfig.KbTaskConfigService;
import com.zifang.z.kb.api.taskconfig.TaskConfigService;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorService;
import com.zifang.z.kb.api.wiki.WikiService;
import com.zifang.z.kb.resource.KbResourceAutoConfiguration;
import com.zifang.z.kb.resource.evaluation.KbEvaluationAutoConfiguration;
import com.zifang.z.kb.web.api.v1.AuditLogController;
import com.zifang.z.kb.web.api.v1.CompilationController;
import com.zifang.z.kb.web.api.v1.ConceptController;
import com.zifang.z.kb.web.api.v1.EvaluationController;
import com.zifang.z.kb.web.api.v1.ExtractionController;
import com.zifang.z.kb.web.api.v1.GraphController;
import com.zifang.z.kb.web.api.v1.KbTaskConfigController;
import com.zifang.z.kb.web.api.v1.KnowledgeBaseController;
import com.zifang.z.kb.web.api.v1.KnowledgeBaseMemberController;
import com.zifang.z.kb.web.api.v1.KnowledgeBaseSourceController;
import com.zifang.z.kb.web.api.v1.KnowledgeRetrievalController;
import com.zifang.z.kb.web.api.v1.MaterialCategoryController;
import com.zifang.z.kb.web.api.v1.MaterialController;
import com.zifang.z.kb.web.api.v1.MaterialRepoController;
import com.zifang.z.kb.web.api.v1.OverviewController;
import com.zifang.z.kb.web.api.v1.TaskConfigController;
import com.zifang.z.kb.web.api.v1.TaskMonitorController;
import com.zifang.z.kb.web.api.v1.WikiController;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;

/**
 * 资源域 v1 REST 装配（{@code /api/kb/v1/**}）。
 *
 * <p><b>条件为什么挂在 {@code @Bean} 方法上而不是类上</b>：类级 {@code @ConditionalOnBean} 在
 * 解析阶段求值，此时同为自动装配的 {@link KbResourceAutoConfiguration} 的 {@code @Bean}
 * 定义尚未注册，条件恒为 false，控制器静默消失（实测：请求落到静态资源处理器的 404）。
 * 方法级条件在定义加载阶段求值，排在 {@code after} 之前的自动装配类已注册完 {@code @Bean}
 * 定义，此时才能看到资源域的三个服务。</p>
 *
 * <p>宿主没有 DataSource（资源域整块不生效）时两个条件都不匹配，v1 路由不注册，
 * 既有 {@code /api/kb/*} 与宿主启动均不受影响。</p>
 */
@AutoConfiguration(after = {KbResourceAutoConfiguration.class, KbEvaluationAutoConfiguration.class,
        KbWebAutoConfiguration.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class KbResourceApiAutoConfiguration {

    @Bean
    @ConditionalOnBean({KnowledgeBaseResourceService.class, KnowledgeBaseConfigService.class})
    public KnowledgeBaseController knowledgeBaseController(
            KnowledgeBaseResourceService resourceService,
            KnowledgeBaseConfigService configService,
            KbCallerResolver callerResolver) {
        return new KnowledgeBaseController(resourceService, configService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(KnowledgeBaseMemberAdminService.class)
    public KnowledgeBaseMemberController knowledgeBaseMemberController(
            KnowledgeBaseMemberAdminService memberService,
            KbCallerResolver callerResolver) {
        return new KnowledgeBaseMemberController(memberService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(MaterialService.class)
    public MaterialController materialController(MaterialService materialService,
                                                 KbCallerResolver callerResolver) {
        return new MaterialController(materialService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(MaterialCategoryService.class)
    public MaterialCategoryController materialCategoryController(
            MaterialCategoryService categoryService, KbCallerResolver callerResolver) {
        return new MaterialCategoryController(categoryService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(MaterialRepoBrowseService.class)
    public MaterialRepoController materialRepoController(
            MaterialRepoBrowseService repoBrowseService, KbCallerResolver callerResolver) {
        return new MaterialRepoController(repoBrowseService, callerResolver);
    }

    @Bean
    @ConditionalOnBean({CompilationService.class, CompilationBatchService.class})
    public CompilationController compilationController(CompilationService compilationService,
                                                       CompilationBatchService compilationBatchService,
                                                       KbCallerResolver callerResolver) {
        return new CompilationController(compilationService, compilationBatchService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(KnowledgeRetrievalService.class)
    public KnowledgeRetrievalController knowledgeRetrievalController(
            KnowledgeRetrievalService retrievalService, KbCallerResolver callerResolver) {
        return new KnowledgeRetrievalController(retrievalService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(OverviewService.class)
    public OverviewController overviewController(OverviewService overviewService,
                                                 KbCallerResolver callerResolver) {
        return new OverviewController(overviewService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(AuditLogService.class)
    public AuditLogController auditLogController(AuditLogService auditLogService,
                                                 KbCallerResolver callerResolver) {
        return new AuditLogController(auditLogService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(TaskConfigService.class)
    public TaskConfigController taskConfigController(TaskConfigService taskConfigService,
                                                     KbCallerResolver callerResolver) {
        return new TaskConfigController(taskConfigService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(KbTaskConfigService.class)
    public KbTaskConfigController kbTaskConfigController(KbTaskConfigService kbTaskConfigService,
                                                         KbCallerResolver callerResolver) {
        return new KbTaskConfigController(kbTaskConfigService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(TaskMonitorService.class)
    public TaskMonitorController taskMonitorController(TaskMonitorService taskMonitorService,
                                                       KbCallerResolver callerResolver) {
        return new TaskMonitorController(taskMonitorService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(ExtractionService.class)
    public ExtractionController kbExtractionApiController(ExtractionService extractionService,
                                                          KbCallerResolver callerResolver) {
        return new ExtractionController(extractionService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(ConceptService.class)
    public ConceptController kbConceptApiController(ConceptService conceptService,
                                                    KbCallerResolver callerResolver) {
        return new ConceptController(conceptService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(GraphService.class)
    public GraphController kbGraphApiController(GraphService graphService,
                                                KbCallerResolver callerResolver) {
        return new GraphController(graphService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(WikiService.class)
    public WikiController kbWikiApiController(WikiService wikiService,
                                              KbCallerResolver callerResolver) {
        return new WikiController(wikiService, callerResolver);
    }

    @Bean
    @ConditionalOnBean(EvaluationService.class)
    public EvaluationController kbEvaluationApiController(EvaluationService evaluationService,
                                                          KbCallerResolver callerResolver) {
        return new EvaluationController(evaluationService, callerResolver);
    }

    @Bean
    @ConditionalOnBean({KnowledgeBaseSourceService.class, IngestService.class})
    public KnowledgeBaseSourceController kbSourceApiController(
            KnowledgeBaseSourceService sourceService, IngestService ingestService,
            KbCallerResolver callerResolver) {
        return new KnowledgeBaseSourceController(sourceService, ingestService, callerResolver);
    }
}
