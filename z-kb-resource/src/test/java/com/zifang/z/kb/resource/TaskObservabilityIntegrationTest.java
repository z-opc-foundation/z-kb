package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.audit.AuditLogQuery;
import com.zifang.z.kb.api.audit.AuditLogService;
import com.zifang.z.kb.api.audit.AuditLogView;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.overview.OverviewService;
import com.zifang.z.kb.api.overview.OverviewView;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.PageResult;
import com.zifang.z.kb.api.taskconfig.KbTaskConfigService;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemView;
import com.zifang.z.kb.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.kb.api.taskconfig.TaskConfigPublishParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigService;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorPageView;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorService;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorSummaryView;
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
@SpringBootTest(classes = KbResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-observability;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/observability-zkb.json",
        "zkb.material.storage.root=target/test-kb/observability-original",
        "zkb.material.repo.root=target/test-kb/observability-repo",
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
    private KbTaskConfigService kbTaskConfigService;

    @Autowired
    private TaskMonitorService taskMonitorService;

    @Autowired
    private OverviewService overviewService;

    @Autowired
    private AuditLogService auditLogService;

    @Test
    @DisplayName("租户任务配置：首访落 2026.10 三性质，发布升到 r2/r3，缺项与越界被拒")
    void tenantTaskConfigSeedsAndPublishes() {
        KbCaller caller = KbCaller.of("t-obs-tenant-cfg", "u-owner");

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

        KBException missing = assertThrows(KBException.class, () -> taskConfigService.publish(
                params("COMPILE", "WIKI"), caller));
        assertEquals("TASK_CONFIG_NATURE_MISSING", missing.getCode());
        assertEquals("任务配置必须覆盖全部三类任务性质", missing.getMessage());

        KBException duplicate = assertThrows(KBException.class, () -> taskConfigService.publish(
                params("COMPILE", "COMPILE", "WIKI"), caller));
        assertEquals("TASK_CONFIG_NATURE_MISSING", duplicate.getCode());

        KBException timeout = assertThrows(KBException.class, () -> taskConfigService.publish(
                panel(("坏-"), 0, 1), caller));
        assertEquals("TASK_CONFIG_PARAM_INVALID", timeout.getCode());

        KBException retry = assertThrows(KBException.class, () -> taskConfigService.publish(
                panel(("坏-"), 300, 6), caller));
        assertEquals("TASK_CONFIG_PARAM_INVALID", retry.getCode());

        KBException blankExecutor = assertThrows(KBException.class, () -> {
            TaskConfigPublishParam broken = panel(("坏-"), 300, 1);
            broken.getItems().get(0).setExecutor(" ");
            taskConfigService.publish(broken, caller);
        });
        assertEquals("TASK_CONFIG_PARAM_INVALID", blankExecutor.getCode());
    }

    @Test
    @DisplayName("库任务配置：未覆盖回落租户版本，发布后独立升版，只读成员不能发布")
    void kbTaskConfigFallsBackAndOverrides() {
        KbCaller owner = KbCaller.of("t-obs-kb-cfg", "u-owner");
        KnowledgeBaseView kb = createKb("库任务配置", owner);

        TaskConfigPanelView fallback = kbTaskConfigService.query(kb.getKbId(), owner);
        assertEquals("2026.10", fallback.getVersion());
        assertEquals("u-owner", fallback.getPublishedBy());

        TaskConfigPanelView published = kbTaskConfigService.publish(kb.getKbId(),
                panel(("库级-"), 900, 2), owner);
        assertEquals("2026.10-r2", published.getVersion());
        assertEquals("库级-executor", published.getItems().get(0).getExecutor());

        TaskConfigPanelView kbPanel = kbTaskConfigService.query(kb.getKbId(), owner);
        assertEquals("2026.10-r2", kbPanel.getVersion());
        assertEquals("库级-WIKI", kbPanel.getItems().get(1).getAgentCode());
        assertEquals("2026.10", taskConfigService.query(owner).getVersion());

        KbCaller reader = KbCaller.of("t-obs-kb-cfg", "u-reader");
        memberAdminService.grant(kb.getKbId(), "u-reader", "READER", owner);
        assertEquals("2026.10-r2", kbTaskConfigService.query(kb.getKbId(), reader).getVersion());
        KBException forbidden = assertThrows(KBException.class,
                () -> kbTaskConfigService.publish(kb.getKbId(), panel(("库级-"), 900, 2), reader));
        assertEquals("KB_ACTION_FORBIDDEN", forbidden.getCode());
    }

    @Test
    @DisplayName("任务监控：编译阶段按类型/状态分页，摘要区分组别与单任务计数")
    void taskMonitorPagesStagesAndSummarizes() {
        KbCaller caller = KbCaller.of("t-obs-monitor", "u-owner");
        KnowledgeBaseView kb = createKb("任务监控", caller);
        String materialId = registerText(kb.getKbId(), "编译监控物料", caller);
        compilationService.run(materialId, null, caller);

        TaskMonitorPageView page = taskMonitorService.page(kb.getKbId(), null, null, 1, 20, caller);
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

        TaskMonitorPageView parse = taskMonitorService.page(kb.getKbId(), "parse", "succeeded",
                1, 20, caller);
        assertEquals(1, parse.getTotal());
        assertEquals("PARSE", parse.getRecords().get(0).getTaskType());

        TaskMonitorSummaryView summary = taskMonitorService.summary(kb.getKbId(), caller);
        assertEquals(1, summary.getJobTotal());
        assertEquals(0, summary.getGroupTotal());
        assertEquals(5, summary.getTaskTotal());

        KBException badStatus = assertThrows(KBException.class,
                () -> taskMonitorService.page(kb.getKbId(), null, "DONE", 1, 20, caller));
        assertEquals("KB_PARAM_INVALID", badStatus.getCode());
        KBException blankKb = assertThrows(KBException.class,
                () -> taskMonitorService.summary(" ", caller));
        assertEquals("KB_PARAM_INVALID", blankKb.getCode());
    }

    @Test
    @DisplayName("概览：物料/已编译/未编译计数与最近物料，非成员不可见")
    void overviewAggregatesKbStats() {
        KbCaller caller = KbCaller.of("t-obs-overview", "u-owner");
        KnowledgeBaseView kb = createKb("概览统计", caller);
        String first = registerText(kb.getKbId(), "概览已编译", caller);
        registerText(kb.getKbId(), "概览未编译", caller);
        compilationService.run(first, null, caller);

        OverviewView view = overviewService.kbStats(kb.getKbId(), caller);
        assertEquals(kb.getKbId(), view.getKbId());
        assertEquals(2, view.getFileCount());
        assertEquals(1, view.getCompiledCount());
        assertEquals(0, view.getPartialCount());
        assertEquals(1, view.getNotCompiledCount());
        assertEquals(0, view.getWikiCount());
        assertEquals(0, view.getRunningTaskCount());
        assertEquals(0, view.getFailedCount());
        assertEquals(2, view.getRecentMaterials().size());
        assertNotNull(view.getRefreshedAt());

        KBException invisible = assertThrows(KBException.class,
                () -> overviewService.kbStats(kb.getKbId(),
                        KbCaller.of("t-obs-overview", "u-stranger")));
        assertEquals("KB_FORBIDDEN", invisible.getCode());
    }

    @Test
    @DisplayName("审计日志：租户隔离、类型/关键词/操作人过滤、分页与按主键详情")
    void auditLogPagesFiltersAndGets() {
        KbCaller caller = KbCaller.of("t-obs-audit", "u-auditor");
        KnowledgeBaseView first = createKb("审计一", caller);
        KnowledgeBaseView second = createKb("审计二", caller);
        resourceService.archive(second.getKbId(), caller);
        resourceService.remove(second.getKbId(), caller);

        PageResult<AuditLogView> byKb = auditLogService.page(query(q -> {
            q.setType("kb");
            q.setBizRef(first.getKbId());
        }), caller);
        assertEquals(1, byKb.getTotal());
        AuditLogView created = byKb.getRecords().get(0);
        assertEquals("kb.create", created.getAction());
        assertEquals("KB", created.getType());
        assertEquals("u-auditor", created.getActorId());
        assertEquals(1, created.getSuccess());
        assertNotNull(created.getCreateTime());
        assertNull(created.getRequestUri());

        PageResult<AuditLogView> keyword = auditLogService.page(
                query(q -> q.setKeyword("kb.create")), caller);
        assertEquals(2, keyword.getTotal());

        PageResult<AuditLogView> sys = auditLogService.page(
                query(q -> q.setType("SYS")), caller);
        assertEquals(1, sys.getTotal());
        assertEquals("kb.remove", sys.getRecords().get(0).getAction());
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
        assertEquals("kb.create", detail.getAction());
        assertNull(auditLogService.get(created.getId(),
                KbCaller.of("t-obs-other-tenant", "u-auditor")));
        assertNull(auditLogService.get("missing-" + UUID.randomUUID(), caller));

        assertEquals(0, auditLogService.page(null,
                KbCaller.of("t-obs-empty-tenant", "u-nobody")).getTotal());
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

    private KnowledgeBaseView createKb(String name, KbCaller caller) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName(name);
        kb.setCode("obs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        return resourceService.create(kb, caller);
    }

    private String registerText(String kbId, String title, KbCaller caller) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null,
                "# " + title + "\n\n用于观测域测试的正文。" + "正文。".repeat(60), caller);
        assertTrue(item.isSuccess(), item.getMessage());
        assertEquals("READY", item.getParseStatus());
        return item.getMaterialId();
    }
}
