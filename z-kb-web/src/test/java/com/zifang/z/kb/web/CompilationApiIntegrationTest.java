package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.material.MaterialService;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 编译域 v1 REST 集成测试：真起 Spring 容器 + H2，按参考实现的路径与信封钉契约。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-compilation-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.vector.storage-type=in-memory",
        "zkb.graph.engine=json",
        "zkb.graph.path=target/test-kb/compilation-api-graph",
        "zkb.storage.path=target/test-kb/compilation-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/compilation-api-original",
        "zkb.material.repo.root=target/test-kb/compilation-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class CompilationApiIntegrationTest {

    private static final String TENANT = "t-compilation-api";
    private static final String ACTOR = "u-compilation-api-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Test
    @DisplayName("单文件编译→查询→检索块→关键词检索→重跑→取消：全链路信封带 data")
    void compileQueryChunksAndRetry() throws Exception {
        String kbId = createKb();
        String content = "# 编译契约\n\n编译域 REST 用 Elasticsearch 做词法检索。\n\n"
                + "## 细节\n\n分块与索引在同一次请求内完成。" + "重复段落。".repeat(60);
        String materialId = registerText(kbId, "编译契约", content);

        MvcResult runResult = mvc.perform(post("/api/kb/v1/compilation/run")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materialId\":\"" + materialId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.runStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.milestone").value("M2"))
                .andExpect(jsonPath("$.data.scopeType").value("SINGLE"))
                .andExpect(jsonPath("$.data.stages.length()").value(5))
                .andExpect(jsonPath("$.data.stages[0].stage").value("REGISTER"))
                .andExpect(jsonPath("$.data.stages[4].stage").value("EXTRACT"))
                .andExpect(jsonPath("$.data.artifact.lifecycleStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.artifact.retrievalState").value("INDEXED"))
                .andReturn();
        JsonNode job = data(runResult);
        String jobId = job.get("jobId").asText();
        assertTrue(job.get("chunkCount").asInt() > 0);

        mvc.perform(get("/api/kb/v1/compilation/queryByMaterial")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.jobId").value(jobId));

        mvc.perform(get("/api/kb/v1/compilation/queryByJob")
                        .param("jobId", jobId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.jobId").value(jobId))
                .andExpect(jsonPath("$.data.stages.length()").value(5));

        mvc.perform(get("/api/kb/v1/compilation/listChunks")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].indexState").value("INDEXED"));

        mvc.perform(get("/api/kb/v1/compilation/search")
                        .param("kbId", kbId)
                        .param("keyword", "Elasticsearch")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].content").value(org.hamcrest.Matchers.containsString("Elasticsearch")));

        mvc.perform(get("/api/kb/v1/compilation/listByKb")
                        .param("kbId", kbId)
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(post("/api/kb/v1/compilation/retry")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobId\":\"" + jobId + "\",\"startStage\":\"P2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.runStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.stages[0].status").value("SKIPPED"))
                .andExpect(jsonPath("$.data.stages[2].status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.artifact.versionNo").value(2));

        mvc.perform(post("/api/kb/v1/compilation/cancel")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobId\":\"" + jobId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.runStatus").value("COMPLETED"));
    }

    @Test
    @DisplayName("组别：创建→查询→列表→分页→运行锁")
    void batchCreateQueryListAndPage() throws Exception {
        String kbId = createKb();
        String first = registerText(kbId, "组别一", "# 一\n\n组别编译第一份。" + "正文。".repeat(80));
        String second = registerText(kbId, "组别二", "# 二\n\n组别编译第二份。" + "正文。".repeat(80));

        MvcResult created = mvc.perform(post("/api/kb/v1/compilation/createBatch")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"scopeType\":\"WORKSPACE\",\"materialIds\":[\""
                                + first + "\",\"" + second + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.totalCount").value(2))
                .andExpect(jsonPath("$.data.successCount").value(2))
                .andExpect(jsonPath("$.data.members.length()").value(2))
                .andExpect(jsonPath("$.data.members[0].itemStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.members[0].milestone").value("M2"))
                .andReturn();
        String batchId = data(created).get("batchId").asText();

        mvc.perform(get("/api/kb/v1/compilation/queryBatch")
                        .param("batchId", batchId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.members.length()").value(2));

        mvc.perform(get("/api/kb/v1/compilation/listBatches")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].members.length()").value(0));

        mvc.perform(get("/api/kb/v1/compilation/pageBatches")
                        .param("kbId", kbId)
                        .param("pageNo", "1")
                        .param("pageSize", "10")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.records[0].batchId").value(batchId));

        mvc.perform(get("/api/kb/v1/compilation/hasRunningBatch")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(false));
    }

    @Test
    @DisplayName("错误映射：任务不存在 404、范围非法 400、组别不存在 404")
    void errorStatusMapping() throws Exception {
        mvc.perform(get("/api/kb/v1/compilation/queryByJob")
                        .param("jobId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("编译任务不存在"));

        String kbId = createKb();
        MvcResult scope = mvc.perform(post("/api/kb/v1/compilation/createBatch")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"scopeType\":\"SINGLE\",\"materialIds\":[\"m-1\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andReturn();
        assertEquals("编译范围不合法：scopeType 只支持 WORKSPACE / CATEGORY / FOLDER",
                objectMapper.readTree(scope.getResponse().getContentAsString(StandardCharsets.UTF_8))
                        .path("message").asText());

        mvc.perform(post("/api/kb/v1/compilation/cancelBatch")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"batchId\":\"missing-" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("编译组别不存在"));
    }

    private JsonNode data(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        JsonNode root = objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8));
        return root.path("data");
    }

    private String createKb() {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("编译接口库");
        kb.setCode("cmpapi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, KbCaller.of(TENANT, ACTOR));
        assertFalse(view.getKbId().isEmpty());
        return view.getKbId();
    }

    private String registerText(String kbId, String title, String content) {
        var item = materialService.registerText(kbId, title, null, content, KbCaller.of(TENANT, ACTOR));
        assertTrue(item.isSuccess(), item.getMessage());
        return item.getMaterialId();
    }
}
