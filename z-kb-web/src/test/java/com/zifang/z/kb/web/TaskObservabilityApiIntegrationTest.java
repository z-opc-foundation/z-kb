package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 任务与观测域 v1 REST 集成测试：概览、审计日志、任务配置（租户/库）与任务监控。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-observability-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/observability-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/observability-api-original",
        "zkb.material.repo.root=target/test-kb/observability-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class TaskObservabilityApiIntegrationTest {

    private static final String TENANT = "t-obs-api";
    private static final String ACTOR = "u-obs-api-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private KnowledgeBaseMemberAdminService memberAdminService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Test
    @DisplayName("概览/任务监控/任务配置/审计日志：九个端点全链路信封带 data")
    void overviewMonitorConfigAndAuditHappyPath() throws Exception {
        String kbId = createKb();
        String materialId = registerText(kbId, "观测接口物料");
        compilationService.run(materialId, null, KbCaller.of(TENANT, ACTOR));

        mvc.perform(get("/api/kb/v1/overview/kbStats")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.kbId").value(kbId))
                .andExpect(jsonPath("$.data.fileCount").value(1))
                .andExpect(jsonPath("$.data.compiledCount").value(1))
                .andExpect(jsonPath("$.data.partialCount").value(0))
                .andExpect(jsonPath("$.data.notCompiledCount").value(0))
                .andExpect(jsonPath("$.data.wikiCount").value(0))
                .andExpect(jsonPath("$.data.runningTaskCount").value(0))
                .andExpect(jsonPath("$.data.failedCount").value(0))
                .andExpect(jsonPath("$.data.recentMaterials.length()").value(1));

        mvc.perform(get("/api/kb/v1/taskMonitor/page")
                        .param("kbId", kbId)
                        .param("taskType", "parse")
                        .param("status", "succeeded")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20))
                .andExpect(jsonPath("$.data.records[0].taskType").value("PARSE"))
                .andExpect(jsonPath("$.data.records[0].status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.records[0].materialTitle").value("观测接口物料"));

        mvc.perform(get("/api/kb/v1/taskMonitor/summary")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.jobTotal").value(1))
                .andExpect(jsonPath("$.data.groupTotal").value(0))
                .andExpect(jsonPath("$.data.taskTotal").value(5));

        mvc.perform(get("/api/kb/v1/taskConfig/query")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("2026.10"))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].taskNature").value("COMPILE"))
                .andExpect(jsonPath("$.data.items[0].taskLabel").value("文档编译"))
                .andExpect(jsonPath("$.data.items[0].taskGroup").value("CHAIN"))
                .andExpect(jsonPath("$.data.items[2].taskNature").value("EVALUATION"))
                .andExpect(jsonPath("$.data.items[2].taskGroup").value("QA"));

        mvc.perform(post("/api/kb/v1/taskConfig/publish")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":" + itemsJson("租户-") + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("2026.10-r2"))
                .andExpect(jsonPath("$.data.publishedBy").value(ACTOR))
                .andExpect(jsonPath("$.data.items[0].executor").value("租户-executor"))
                .andExpect(jsonPath("$.data.items[0].timeoutSeconds").value(300));

        mvc.perform(get("/api/kb/v1/taskConfig/kb/query")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("2026.10-r2"))
                .andExpect(jsonPath("$.data.items[0].executor").value("租户-executor"));

        mvc.perform(post("/api/kb/v1/taskConfig/kb/publish")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"items\":" + itemsJson("库级-") + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("2026.10-r3"))
                .andExpect(jsonPath("$.data.items[0].executor").value("库级-executor"));

        mvc.perform(get("/api/kb/v1/taskConfig/kb/query")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("2026.10-r3"));

        MvcResult audited = mvc.perform(post("/api/kb/v1/auditLog/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"KB\",\"bizRef\":\"" + kbId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.records.length()").value(2))
                .andExpect(jsonPath("$.data.size").value(20))
                .andReturn();
        JsonNode records = data(audited).path("records");
        boolean hasCreate = false;
        boolean hasPublish = false;
        for (JsonNode record : records) {
            hasCreate |= "kb.create".equals(record.path("action").asText());
            hasPublish |= "kb.task.config.publish".equals(record.path("action").asText());
            assertEquals("KB", record.path("type").asText());
            assertEquals(ACTOR, record.path("actorId").asText());
            assertEquals(1, record.path("success").asInt());
        }
        assertTrue(hasCreate);
        assertTrue(hasPublish);

        String auditId = records.get(0).path("id").asText();
        mvc.perform(get("/api/kb/v1/auditLog/get")
                        .param("id", auditId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(auditId));

        mvc.perform(post("/api/kb/v1/auditLog/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"keyword\":\"kb.task.config.publish\",\"current\":1,\"size\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records.length()").value(1))
                .andExpect(jsonPath("$.data.records[0].action").value("kb.task.config.publish"));

        mvc.perform(post("/api/kb/v1/auditLog/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2));
    }

    @Test
    @DisplayName("错误映射：库不存在 404、状态非法 400、缺任务性质 400、只读成员 403")
    void errorStatusMapping() throws Exception {
        mvc.perform(get("/api/kb/v1/overview/kbStats")
                        .param("kbId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));

        String kbId = createKb();
        mvc.perform(get("/api/kb/v1/taskMonitor/page")
                        .param("kbId", kbId)
                        .param("status", "DONE")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("知识库参数不合法"));

        mvc.perform(post("/api/kb/v1/taskConfig/publish")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"taskNature\":\"COMPILE\",\"executionMode\":\"CODE\","
                                + "\"executor\":\"e\",\"timeoutSeconds\":300,\"retryLimit\":1}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("任务配置必须覆盖全部三类任务性质"));

        MvcResult missingAudit = mvc.perform(get("/api/kb/v1/auditLog/get")
                        .param("id", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();
        assertTrue(root(missingAudit).path("data").isNull());

        KbCaller reader = KbCaller.of(TENANT, "u-obs-reader");
        memberAdminService.grant(kbId, "u-obs-reader", "READER", KbCaller.of(TENANT, ACTOR));
        mvc.perform(get("/api/kb/v1/overview/kbStats")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", "u-obs-reader"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        mvc.perform(post("/api/kb/v1/taskConfig/kb/publish")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", reader.getActorId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"items\":" + itemsJson("越权-") + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    private String itemsJson(String prefix) {
        String[] natures = {"COMPILE", "WIKI", "EVALUATION"};
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < natures.length; i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append("{\"taskNature\":\"").append(natures[i]).append("\",")
                    .append("\"executionMode\":\"AGENT\",")
                    .append("\"executor\":\"").append(prefix).append("executor\",")
                    .append("\"agentCode\":\"").append(prefix).append(natures[i]).append("\",")
                    .append("\"model\":\"gpt-4o\",\"skills\":\"knowledge_search\",")
                    .append("\"tools\":\"chunker\",\"promptVersion\":\"p@1\",")
                    .append("\"outputContract\":\"retrieval_chunk\",")
                    .append("\"timeoutSeconds\":300,\"retryLimit\":1,")
                    .append("\"boundaryNote\":\"边界\"}");
        }
        return builder.append(']').toString();
    }

    private JsonNode data(MvcResult result) throws Exception {
        return root(result).path("data");
    }

    private JsonNode root(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        return objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8));
    }

    private String createKb() {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("观测接口库");
        kb.setCode("obsapi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, KbCaller.of(TENANT, ACTOR));
        assertFalse(view.getKbId().isEmpty());
        return view.getKbId();
    }

    private String registerText(String kbId, String title) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null,
                "# " + title + "\n\n观测域接口测试正文。" + "正文。".repeat(60),
                KbCaller.of(TENANT, ACTOR));
        assertTrue(item.isSuccess(), item.getMessage());
        return item.getMaterialId();
    }
}
