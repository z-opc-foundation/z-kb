package com.zifang.z.***REMOVED***.resource;

import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.audit.AuditLogQuery;
import com.zifang.z.***REMOVED***.api.audit.AuditLogService;
import com.zifang.z.***REMOVED***.api.audit.AuditLogView;
import com.zifang.z.***REMOVED***.api.compilation.CompilationService;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.material.MaterialUploadItem;
import com.zifang.z.***REMOVED***.api.overview.OverviewService;
import com.zifang.z.***REMOVED***.api.overview.OverviewView;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBase;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseType;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.api.taskconfig.***REMOVED***TaskConfigService;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigItemView;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPublishParam;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorPageView;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorSummaryView;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 任务与观测域集成测试：概览、审计日志、任务配置（租户/库）与任务监控，真起 H2。
 */
@SpringBootTest(classes = ***REMOVED***ResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:z***REMOVED***-observability;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "z***REMOVED***.storage.path=target/test-***REMOVED***/observability-z***REMOVED***.json",
        "z***REMOVED***.material.storage.root=target/test-***REMOVED***/observability-original",
        "z***REMOVED***.material.repo.root=target/test-***REMOVED***/observability-repo",
        "spring.main.banner-mode=off"
})
class TaskObservabilityIntegrationTest {

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private KnowledgeBaseMemberAdminService memberAdminService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Autowired
    private TaskConfigService taskConfigService;

    @Autowired
    private ***REMOVED***TaskConfigService ***REMOVED***TaskConfigService;

    @Autowired
    private TaskMonitorService taskMonitorService;

    @Autowired
    private OverviewService overviewService;

    @Autowired
    private AuditLogService auditLogService;

    @Test
    @DisplayName("租户任务配置：首访落 2026.10 三性质，发布升到 r2/r3，缺项与越界被拒")
    void tenantTaskConfigSeedsAndPublishes() {
        ***REMOVED***Caller caller = ***REMOVED***Caller.of("t-obs-tenant-cfg", "u-owner");

        TaskConfigPanelView initial = taskConfigService.query(caller);
        assertEquals("2026.10", initial.getVersion());
        assertEquals(3, initial.getItems().size());
        List<String> natures = new ArrayList<>();
        for (TaskConfigItemView item : initial.getItems()) {
            natures.add(item.getTaskNature());
        }
        assertEquals(Arrays.asList("COMPILE", "WIKI", "EVALUATION"), natures);
        assertEquals("文档编译", initial.getItems().get(0).getTaskLabel());
        assertEquals("CHAIN", initial.getItems().get(0).getTaskGroup());
        assertEquals("QA", initial.getItems().get(2).getTaskGroup());
        assertNotNull(initial.getPublishedAt());
        assertEquals("u-owner", initial.getPublishedBy());

        TaskConfigPanelView published = taskConfigService.publish(
                panel(("自定义编译-"), 600, 2), caller);
        assertEquals("2026.10-r2", published.getVersion());
        assertEquals(3, published.getItems().size());
        assertEquals("自定义编译-executor", published.getItems().get(0).getExecutor());
        assertEquals("自定义编译-COMPILE", published.getItems().get(0).getAgentCode());
        assertEquals(600, published.getItems().get(0).getTimeoutSeconds());
        assertEquals("AGENT", published.getItems().get(0).getExecutionMode());

        TaskConfigPanelView next = taskConfigService.publish(panel(("二版-"), 300, 1), caller);
        assertEquals("2026.10-r3", next.getVersion());
        assertEquals("二版-executor", next.getItems().get(1).getExecutor());

        ***REMOVED***Exception missing = assertThrows(***REMOVED***Exception.class, () -> taskConfigService.publish(
                params("COMPILE", "WIKI"), caller));
        assertEquals("TASK_CONFIG_NATURE_MISSING", missing.getCode());
        assertEquals("任务配置必须覆盖全部三类任务性质", missing.getMessage());

        ***REMOVED***Exception duplicate = assertThrows(***REMOVED***Exception.class, () -> taskConfigService.publish(
                params("COMPILE", "COMPILE", "WIKI"), caller));
        assertEquals("TASK_CONFIG_NATURE_MISSING", duplicate.getCode());

        ***REMOVED***Exception timeout = assertThrows(***REMOVED***Exception.class, () -> taskConfigService.publish(
                panel(("坏-"), 0, 1), caller));
        assertEquals("TASK_CONFIG_PARAM_INVALID", timeout.getCode());

        ***REMOVED***Exception retry = assertThrows(***REMOVED***Exception.class, () -> taskConfigService.publish(
                panel(("坏-"), 300, 6), caller));
        assertEquals("TASK_CONFIG_PARAM_INVALID", retry.getCode());

        ***REMOVED***Exception blankExecutor = assertThrows(***REMOVED***Exception.class, () -> {
            TaskConfigPublishParam broken = panel(("坏-"), 300, 1);
            broken.getItems().get(0).setExecutor(" ");
            taskConfigService.publish(broken, caller);
        });
        assertEquals("TASK_CONFIG_PARAM_INVALID", blankExecutor.getCode());
    }

    @Test
    @DisplayName("库任务配置：未覆盖回落租户版本，发布后独立升版，只读成员不能发布")
    void ***REMOVED***TaskConfigFallsBackAndOverrides() {
        ***REMOVED***Caller owner = ***REMOVED***Caller.of("t-obs-***REMOVED***-cfg", "u-owner");
        KnowledgeBaseView ***REMOVED*** = create***REMOVED***("库任务配置", owner);

        TaskConfigPanelView fallback = ***REMOVED***TaskConfigService.query(***REMOVED***.get***REMOVED***Id(), owner);
        assertEquals("2026.10", fallback.getVersion());
        assertEquals("u-owner", fallback.getPublishedBy());

        TaskConfigPanelView published = ***REMOVED***TaskConfigService.publish(***REMOVED***.get***REMOVED***Id(),
                panel(("库级-"), 900, 2), owner);
        assertEquals("2026.10-r2", published.getVersion());
        assertEquals("库级-executor", published.getItems().get(0).getExecutor());

        TaskConfigPanelView ***REMOVED***Panel = ***REMOVED***TaskConfigService.query(***REMOVED***.get***REMOVED***Id(), owner);
        assertEquals("2026.10-r2", ***REMOVED***Panel.getVersion());
        assertEquals("库级-WIKI", ***REMOVED***Panel.getItems().get(1).getAgentCode());
        assertEquals("2026.10", taskConfigService.query(owner).getVersion());

        ***REMOVED***Caller reader = ***REMOVED***Caller.of("t-obs-***REMOVED***-cfg", "u-reader");
        memberAdminService.grant(***REMOVED***.get***REMOVED***Id(), "u-reader", "READER", owner);
        assertEquals("2026.10-r2", ***REMOVED***TaskConfigService.query(***REMOVED***.get***REMOVED***Id(), reader).getVersion());
        ***REMOVED***Exception forbidden = assertThrows(***REMOVED***Exception.class,
                () -> ***REMOVED***TaskConfigService.publish(***REMOVED***.get***REMOVED***Id(), panel(("库级-"), 900, 2), reader));
        assertEquals("***REMOVED***ACTION_FORBIDDEN", forbidden.getCode());
    }

    @Test
    @DisplayName("任务监控：编译阶段按类型/状态分页，摘要区分组别与单任务计数")
    void taskMonitorPagesStagesAndSummarizes() {
        ***REMOVED***Caller caller = ***REMOVED***Caller.of("t-obs-monitor", "u-owner");
        KnowledgeBaseView ***REMOVED*** = create***REMOVED***("任务监控", caller);
        String materialId = registerText(***REMOVED***.get***REMOVED***Id(), "编译监控物料", caller);
        compilationService.run(materialId, null, caller);

        TaskMonitorPageView page = taskMonitorService.page(***REMOVED***.get***REMOVED***Id(), null, null, 1, 20, caller);
        assertEquals(5, page.getTotal());
        assertEquals(1, page.getPageNo());
        assertEquals(20, page.getPageSize());
        assertEquals(5, page.getRecords().size());
        assertNotNull(page.getRecords().get(0).getTaskId());
        assertEquals("SUCCEEDED", page.getRecords().get(0).getStatus());
        assertEquals(1, page.getRecords().get(0).getAttempt());
        assertEquals(1, page.getRecords().get(0).getMaxAttempts());
        assertEquals("编译监控物料", page.getRecords().get(0).getMaterialTitle());
        assertNotNull(page.getRecords().get(0).getBizKey());
        assertNotNull(page.getRecords().get(0).getCreateTime());

        TaskMonitorPageView parse = taskMonitorService.page(***REMOVED***.get***REMOVED***Id(), "parse", "succeeded",
                1, 20, caller);
        assertEquals(1, parse.getTotal());
        assertEquals("PARSE", parse.getRecords().get(0).getTaskType());

        TaskMonitorSummaryView summary = taskMonitorService.summary(***REMOVED***.get***REMOVED***Id(), caller);
        assertEquals(1, summary.getJobTotal());
        assertEquals(0, summary.getGroupTotal());
        assertEquals(5, summary.getTaskTotal());

        ***REMOVED***Exception badStatus = assertThrows(***REMOVED***Exception.class,
                () -> taskMonitorService.page(***REMOVED***.get***REMOVED***Id(), null, "DONE", 1, 20, caller));
        assertEquals("***REMOVED***PARAM_INVALID", badStatus.getCode());
        ***REMOVED***Exception blank***REMOVED*** = assertThrows(***REMOVED***Exception.class,
                () -> taskMonitorService.summary(" ", caller));
        assertEquals("***REMOVED***PARAM_INVALID", blank***REMOVED***.getCode());
    }

    @Test
    @DisplayName("概览：物料/已编译/未编译计数与最近物料，非成员不可见")
    void overviewAggregates***REMOVED***Stats() {
        ***REMOVED***Caller caller = ***REMOVED***Caller.of("t-obs-overview", "u-owner");
        KnowledgeBaseView ***REMOVED*** = create***REMOVED***("概览统计", caller);
        String first = registerText(***REMOVED***.get***REMOVED***Id(), "概览已编译", caller);
        registerText(***REMOVED***.get***REMOVED***Id(), "概览未编译", caller);
        compilationService.run(first, null, caller);

        OverviewView view = overviewService.***REMOVED***Stats(***REMOVED***.get***REMOVED***Id(), caller);
        assertEquals(***REMOVED***.get***REMOVED***Id(), view.get***REMOVED***Id());
        assertEquals(2, view.getFileCount());
        assertEquals(1, view.getCompiledCount());
        assertEquals(0, view.getPartialCount());
        assertEquals(1, view.getNotCompiledCount());
        assertEquals(0, view.getWikiCount());
        assertEquals(0, view.getRunningTaskCount());
        assertEquals(0, view.getFailedCount());
        assertEquals(2, view.getRecentMaterials().size());
        assertNotNull(view.getRefreshedAt());

        ***REMOVED***Exception invisible = assertThrows(***REMOVED***Exception.class,
                () -> overviewService.***REMOVED***Stats(***REMOVED***.get***REMOVED***Id(),
                        ***REMOVED***Caller.of("t-obs-overview", "u-stranger")));
        assertEquals("***REMOVED***FORBIDDEN", invisible.getCode());
    }

    @Test
    @DisplayName("审计日志：租户隔离、类型/关键词/操作人过滤、分页与按主键详情")
    void auditLogPagesFiltersAndGets() {
        ***REMOVED***Caller caller = ***REMOVED***Caller.of("t-obs-audit", "u-auditor");
        KnowledgeBaseView first = create***REMOVED***("审计一", caller);
        KnowledgeBaseView second = create***REMOVED***("审计二", caller);
        resourceService.archive(second.get***REMOVED***Id(), caller);
        resourceService.remove(second.get***REMOVED***Id(), caller);

        PageResult<AuditLogView> by***REMOVED*** = auditLogService.page(query(q -> {
            q.setType("***REMOVED***");
            q.setBizRef(first.get***REMOVED***Id());
        }), caller);
        assertEquals(1, by***REMOVED***.getTotal());
        AuditLogView created = by***REMOVED***.getRecords().get(0);
        assertEquals("***REMOVED***.create", created.getAction());
        assertEquals("***REMOVED***", created.getType());
        assertEquals("u-auditor", created.getActorId());
        assertEquals(1, created.getSuccess());
        assertNotNull(created.getCreateTime());
        assertNull(created.getRequestUri());

        PageResult<AuditLogView> keyword = auditLogService.page(
                query(q -> q.setKeyword("***REMOVED***.create")), caller);
        assertEquals(2, keyword.getTotal());

        PageResult<AuditLogView> sys = auditLogService.page(
                query(q -> q.setType("SYS")), caller);
        assertEquals(1, sys.getTotal());
        assertEquals("***REMOVED***.remove", sys.getRecords().get(0).getAction());
        assertNull(sys.getRecords().get(0).getBizRef());

        PageResult<AuditLogView> actor = auditLogService.page(
                query(q -> q.setActorId("u-nobody")), caller);
        assertEquals(0, actor.getTotal());

        PageResult<AuditLogView> paged = auditLogService.page(query(q -> {
            q.setCurrent(1);
            q.setSize(2);
        }), caller);
        assertEquals(4, paged.getTotal());
        assertEquals(2, paged.getRecords().size());
        assertEquals(2, paged.getPages());

        AuditLogView detail = auditLogService.get(created.getId(), caller);
        assertNotNull(detail);
        assertEquals("***REMOVED***.create", detail.getAction());
        assertNull(auditLogService.get(created.getId(),
                ***REMOVED***Caller.of("t-obs-other-tenant", "u-auditor")));
        assertNull(auditLogService.get("missing-" + UUID.randomUUID(), caller));

        assertEquals(0, auditLogService.page(null,
                ***REMOVED***Caller.of("t-obs-empty-tenant", "u-nobody")).getTotal());
    }

    private TaskConfigPublishParam panel(String prefix, int timeoutSeconds, int retryLimit) {
        return panelOf(prefix, timeoutSeconds, retryLimit);
    }

    private TaskConfigPublishParam panelOf(String prefix, int timeoutSeconds, int retryLimit) {
        TaskConfigPublishParam param = new TaskConfigPublishParam();
        List<TaskConfigItemParam> items = new ArrayList<>();
        for (String nature : Arrays.asList("COMPILE", "WIKI", "EVALUATION")) {
            TaskConfigItemParam item = new TaskConfigItemParam();
            item.setTaskNature(nature);
            item.setExecutionMode("AGENT");
            item.setExecutor(prefix + "executor");
            item.setAgentCode(prefix + nature);
            item.setModel("gpt-4o");
            item.setSkills("knowledge_search");
            item.setTools("chunker");
            item.setPromptVersion("p@1");
            item.setOutputContract("retrieval_chunk");
            item.setTimeoutSeconds(timeoutSeconds);
            item.setRetryLimit(retryLimit);
            item.setBoundaryNote("边界说明");
            items.add(item);
        }
        param.setItems(items);
        return param;
    }

    private TaskConfigPublishParam params(String... natures) {
        TaskConfigPublishParam param = new TaskConfigPublishParam();
        List<TaskConfigItemParam> items = new ArrayList<>();
        for (String nature : natures) {
            TaskConfigItemParam item = new TaskConfigItemParam();
            item.setTaskNature(nature);
            item.setExecutionMode("CODE");
            item.setExecutor("executor");
            item.setTimeoutSeconds(300);
            item.setRetryLimit(1);
            items.add(item);
        }
        param.setItems(items);
        return param;
    }

    private AuditLogQuery query(java.util.function.Consumer<AuditLogQuery> customizer) {
        AuditLogQuery query = new AuditLogQuery();
        customizer.accept(query);
        return query;
    }

    private KnowledgeBaseView create***REMOVED***(String name, ***REMOVED***Caller caller) {
        KnowledgeBase ***REMOVED*** = new KnowledgeBase();
        ***REMOVED***.setName(name);
        ***REMOVED***.setCode("obs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        ***REMOVED***.setType(KnowledgeBaseType.FILE);
        return resourceService.create(***REMOVED***, caller);
    }

    private String registerText(String ***REMOVED***Id, String title, ***REMOVED***Caller caller) {
        MaterialUploadItem item = materialService.registerText(***REMOVED***Id, title, null,
                "# " + title + "\n\n用于观测域测试的正文。" + "正文。".repeat(60), caller);
        assertTrue(item.isSuccess(), item.getMessage());
        assertEquals("READY", item.getParseStatus());
        return item.getMaterialId();
    }
}
