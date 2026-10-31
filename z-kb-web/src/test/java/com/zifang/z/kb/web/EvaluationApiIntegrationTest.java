package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 评测域 v1 REST 集成测试：QA 集合版本、同步跑批、四层指标、坏例台账与错误码映射。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-eval-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/eval-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/eval-api-original",
        "zkb.material.repo.root=target/test-kb/eval-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class EvaluationApiIntegrationTest {

    private static final String TENANT = "t-eval-api";
    private static final String ACTOR = "u-eval-api-owner";

    private static final String CONTENT =
            "# 检索增强\n\n检索增强依赖向量索引。\n\n## 图谱\n\n知识库需要图谱。";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Test
    @DisplayName("全链路：草稿→发布→跑批→复用→详情→逐题→可信证据→概览")
    void datasetRunAndQueryFlow() throws Exception {
        String kbId = compiledKb("评测全链路库");

        Map<String, Object> answerCase = new LinkedHashMap<>();
        answerCase.put("question", "检索增强依赖什么");
        answerCase.put("expectedAnswer", "向量索引");
        answerCase.put("expectedBehavior", "ANSWER");
        answerCase.put("expectedEvidence", Map.of("materialIds",
                List.of(materialIdOf(kbId))));
        Map<String, Object> refuseCase = new LinkedHashMap<>();
        refuseCase.put("question", "火星表面的平均温度是多少");
        refuseCase.put("expectedBehavior", "REFUSE");

        mvc.perform(post("/api/kb/v1/evaluation/saveDatasetDraft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "name", "评测 QA 集合",
                                "cases", List.of(answerCase, refuseCase))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.versionNo").value(1))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.caseCount").value(2));

        mvc.perform(post("/api/kb/v1/evaluation/publishDataset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "expectedVersionNo", 1)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FROZEN"))
                .andExpect(jsonPath("$.data.versionNo").value(1));

        mvc.perform(get("/api/kb/v1/evaluation/queryDataset")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dataset.status").value("FROZEN"))
                .andExpect(jsonPath("$.data.dataset.versionNo").value(1))
                .andExpect(jsonPath("$.data.cases.length()").value(2))
                .andExpect(jsonPath("$.data.cases[0].caseNo").value(1))
                .andExpect(jsonPath("$.data.cases[0].expectedBehavior").value("ANSWER"))
                .andExpect(jsonPath("$.data.cases[1].expectedBehavior").value("REFUSE"));

        mvc.perform(get("/api/kb/v1/evaluation/queryOverview")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kbId").value(kbId))
                .andExpect(jsonPath("$.data.dataset.versionNo").value(1))
                .andExpect(jsonPath("$.data.lastRun").doesNotExist())
                .andExpect(jsonPath("$.data.badcaseCounts.open").value(0))
                .andExpect(jsonPath("$.data.notConnected.length()").value(4));

        MvcResult created = mvc.perform(post("/api/kb/v1/evaluation/createRun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.reused").value(false))
                .andExpect(jsonPath("$.data.datasetVersionNo").value(1))
                .andExpect(jsonPath("$.data.judgeVersion").value("local-rule-v1"))
                .andExpect(jsonPath("$.data.caseTotal").value(2))
                .andExpect(jsonPath("$.data.caseDone").value(2))
                .andReturn();
        JsonNode createdData = data(created);
        String runId = createdData.path("runId").asText();
        assertFalse(runId.isEmpty());
        assertFalse(createdData.path("snapshotId").asText().isEmpty());
        assertTrue(createdData.path("resultUsable").asBoolean(),
                "同口径全绿的跑批应可用：" + createdData.path("unusableReason").asText());

        mvc.perform(post("/api/kb/v1/evaluation/createRun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reused").value(true))
                .andExpect(jsonPath("$.data.runId").value(runId));

        mvc.perform(get("/api/kb/v1/evaluation/queryRun")
                        .param("runId", runId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.run.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.run.resultUsable").value(true))
                .andExpect(jsonPath("$.data.run.scopeType").value("FULL"))
                .andExpect(jsonPath("$.data.run.caseDone").value(2))
                .andExpect(jsonPath("$.data.metrics.length()").value(30))
                .andExpect(jsonPath("$.data.stages.length()").value(8))
                .andExpect(jsonPath("$.data.stages[0].stageCode").value("S1"))
                .andExpect(jsonPath("$.data.comparable").value(false))
                .andExpect(jsonPath("$.data.badcaseCounts.open").value(0))
                .andExpect(jsonPath("$.data.evidence.length()").value(5));

        MvcResult casePage = mvc.perform(post("/api/kb/v1/evaluation/pageCaseResults")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("runId", runId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.records.length()").value(2))
                .andReturn();
        Map<Integer, JsonNode> byCaseNo = new LinkedHashMap<>();
        for (JsonNode record : data(casePage).path("records")) {
            byCaseNo.put(record.path("caseNo").asInt(), record);
            assertEquals(0, record.path("badcaseStages").size(),
                    "全绿用例不应挂坏例阶段：" + record.path("question").asText());
        }
        assertEquals("EXTRACTIVE_TOP3", byCaseNo.get(1).path("answerMode").asText());
        assertEquals("REFUSED", byCaseNo.get(2).path("answerMode").asText());
        assertFalse(byCaseNo.get(1).path("answer").asText().isEmpty());

        mvc.perform(post("/api/kb/v1/evaluation/pageCaseResults")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("runId", runId, "onlyBad", true)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));

        mvc.perform(get("/api/kb/v1/evaluation/queryTrustEvidence")
                        .param("runId", runId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(5))
                .andExpect(jsonPath("$.data.items[0].code").value("VERSION"))
                .andExpect(jsonPath("$.data.items[0].status").value("READY"))
                .andExpect(jsonPath("$.data.items[3].code").value("CASE_TRACE"))
                .andExpect(jsonPath("$.data.items[3].status").value("READY"));

        mvc.perform(get("/api/kb/v1/evaluation/pageKnowledgeBase")
                        .param("keyword", "评测全链路库")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].kbId").value(kbId))
                .andExpect(jsonPath("$.data.records[0].datasetVersion").value(1))
                .andExpect(jsonPath("$.data.records[0].datasetStatus").value("FROZEN"))
                .andExpect(jsonPath("$.data.records[0].lastRunId").value(runId))
                .andExpect(jsonPath("$.data.records[0].resultUsable").value(true))
                .andExpect(jsonPath("$.data.records[0].coreTotal").value(6))
                .andExpect(jsonPath("$.data.records[0].openBadcaseCount").value(0));

        mvc.perform(get("/api/kb/v1/evaluation/listBadcases")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0))
                .andExpect(jsonPath("$.data.records.length()").value(0));
    }

    @Test
    @DisplayName("坏例台账：失败阶段归因、状态流转与统计")
    void badcaseLifecycle() throws Exception {
        String kbId = compiledKb("评测坏例库");

        Map<String, Object> brokenCase = new LinkedHashMap<>();
        brokenCase.put("question", "检索增强依赖什么");
        brokenCase.put("expectedAnswer", "向量索引");
        brokenCase.put("expectedEvidence", Map.of("materialIds",
                List.of("missing-material-" + UUID.randomUUID())));
        Map<String, Object> healthyCase = new LinkedHashMap<>();
        healthyCase.put("question", "知识库需要什么");
        healthyCase.put("expectedAnswer", "图谱");
        healthyCase.put("expectedEvidence", Map.of("materialIds",
                List.of(materialIdOf(kbId))));

        saveAndPublish(kbId, List.of(brokenCase, healthyCase));
        String runId = createRun(kbId);

        mvc.perform(get("/api/kb/v1/evaluation/listBadcases")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.records[0].status").value("OPEN"))
                .andExpect(jsonPath("$.data.records[0].occurrenceCount").value(1))
                .andExpect(jsonPath("$.data.records[0].question").value("检索增强依赖什么"));

        MvcResult listed = mvc.perform(get("/api/kb/v1/evaluation/listBadcases")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode records = data(listed).path("records");
        String badcaseId = records.get(0).path("badcaseId").asText();
        String stageCode = records.get(0).path("stageCode").asText();
        assertFalse(badcaseId.isEmpty());
        assertFalse(stageCode.isEmpty());

        mvc.perform(get("/api/kb/v1/evaluation/listBadcases")
                        .param("kbId", kbId)
                        .param("stageCode", stageCode)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].stageCode").value(stageCode));

        mvc.perform(post("/api/kb/v1/evaluation/updateBadcase")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("badcaseId", badcaseId, "status", "FIXED",
                                "owner", ACTOR, "note", "已补资料")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.badcaseId").value(badcaseId))
                .andExpect(jsonPath("$.data.status").value("FIXED"))
                .andExpect(jsonPath("$.data.owner").value(ACTOR))
                .andExpect(jsonPath("$.data.note").value("已补资料"));

        mvc.perform(get("/api/kb/v1/evaluation/listBadcases")
                        .param("kbId", kbId)
                        .param("status", "FIXED")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));

        mvc.perform(get("/api/kb/v1/evaluation/queryOverview")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastRun.runId").value(runId))
                .andExpect(jsonPath("$.data.lastRun.coreTotal").value(6))
                .andExpect(jsonPath("$.data.badcaseCounts.open").value(2))
                .andExpect(jsonPath("$.data.badcaseCounts.fixed").value(1))
                .andExpect(jsonPath("$.data.badcaseCounts.regressed").value(0));

        mvc.perform(post("/api/kb/v1/evaluation/updateBadcase")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("badcaseId", "missing-" + UUID.randomUUID(),
                                "status", "FIXED")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("坏例不存在"));

        mvc.perform(post("/api/kb/v1/evaluation/updateBadcase")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("badcaseId", badcaseId, "status", "UNKNOWN")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("坏例状态不合法"));
    }

    @Test
    @DisplayName("错误码映射：参数 400、资源 404、状态 409")
    void errorCodeMapping() throws Exception {
        String kbId = compiledKb("评测错误码库");

        mvc.perform(get("/api/kb/v1/evaluation/queryRun")
                        .param("runId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("评测跑批不存在"));

        mvc.perform(post("/api/kb/v1/evaluation/createRun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "scopeType", "STAGE",
                                "stageCode", "S9")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("评测阶段不合法"));

        mvc.perform(post("/api/kb/v1/evaluation/createRun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("评测数据集不存在"));

        mvc.perform(post("/api/kb/v1/evaluation/saveDatasetDraft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "cases", List.of())))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("评测数据集没有可用题目"));

        mvc.perform(post("/api/kb/v1/evaluation/publishDataset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("评测数据集不存在"));

        mvc.perform(get("/api/kb/v1/evaluation/queryDataset")
                        .param("kbId", kbId)
                        .param("versionNo", "9")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("评测数据集不存在"));

        Map<String, Object> oneCase = new LinkedHashMap<>();
        oneCase.put("question", "知识库需要什么");
        oneCase.put("expectedAnswer", "图谱");
        saveAndPublish(kbId, List.of(oneCase));

        mvc.perform(post("/api/kb/v1/evaluation/publishDataset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("评测数据集不存在"));
    }

    // ------------------------------------------------------------------ 辅助

    private String compiledKb(String name) {
        String kbId = createKb(name);
        materialService.registerText(kbId, "检索增强资料.md", null, CONTENT,
                KbCaller.of(TENANT, ACTOR));
        compilationService.run(materialIdOf(kbId), null, KbCaller.of(TENANT, ACTOR));
        return kbId;
    }

    private String createKb(String name) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName(name);
        kb.setCode("eval_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, KbCaller.of(TENANT, ACTOR));
        assertFalse(view.getKbId().isEmpty());
        return view.getKbId();
    }

    private String materialIdOf(String kbId) {
        List<String> ids = new ArrayList<>();
        try {
            MvcResult result = mvc.perform(post("/api/kb/v1/material/page")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("kbId", kbId)))
                            .header("X-Tenant-Code", TENANT)
                            .header("X-Actor-Id", ACTOR))
                    .andExpect(status().isOk())
                    .andReturn();
            for (JsonNode record : data(result).path("records")) {
                ids.add(record.path("materialId").asText());
            }
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        assertEquals(1, ids.size(), "测试库应恰有一份资料");
        return ids.get(0);
    }

    private void saveAndPublish(String kbId, List<Map<String, Object>> cases) throws Exception {
        mvc.perform(post("/api/kb/v1/evaluation/saveDatasetDraft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "cases", cases)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
        mvc.perform(post("/api/kb/v1/evaluation/publishDataset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FROZEN"));
    }

    private String createRun(String kbId) throws Exception {
        MvcResult result = mvc.perform(post("/api/kb/v1/evaluation/createRun")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCEEDED"))
                .andReturn();
        return data(result).path("runId").asText();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode data(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        return objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8)).path("data");
    }
}
