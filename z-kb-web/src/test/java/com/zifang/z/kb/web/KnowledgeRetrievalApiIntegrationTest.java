package com.zifang.z.kb.web;

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

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 检索域 v1 REST 集成测试：真起 Spring 容器 + H2，钉住参考实现的路径、信封与错误码。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-retrieval-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.vector.storage-type=in-memory",
        "zkb.graph.engine=json",
        "zkb.graph.path=target/test-kb/retrieval-api-graph",
        "zkb.storage.path=target/test-kb/retrieval-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/retrieval-api-original",
        "zkb.material.repo.root=target/test-kb/retrieval-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class KnowledgeRetrievalApiIntegrationTest {

    private static final String TENANT = "t-retrieval-api";
    private static final String ACTOR = "u-retrieval-api-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Test
    @DisplayName("库内检索：命中带分数与解释，参数错误按 400 返回")
    void retrieveReturnsExplainedHits() throws Exception {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("检索接口库");
        kb.setCode("retapi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, caller);
        String kbId = view.getKbId();
        String content = "# 检索接口\n\nElasticsearch 负责全文检索，Qdrant 负责向量召回。"
                + "检索说明。".repeat(200);
        var item = materialService.registerText(kbId, "检索接口", null, content, caller);
        assertTrue(item.isSuccess(), item.getMessage());

        mvc.perform(post("/api/kb/v1/compilation/run")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materialId\":\"" + item.getMaterialId() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.runStatus").value("COMPLETED"));

        mvc.perform(post("/api/kb/v1/knowledgeBase/retrieve")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"query\":\"Elasticsearch 检索\","
                                + "\"topK\":2,\"minScore\":0.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.mode").value("dense"))
                .andExpect(jsonPath("$.data.embeddingModel").value("local-hash-ngram-v1"))
                .andExpect(jsonPath("$.data.topK").value(2))
                .andExpect(jsonPath("$.data.hits.length()").value(2))
                .andExpect(jsonPath("$.data.hits[0].rank").value(1))
                .andExpect(jsonPath("$.data.hits[0].materialTitle").value("检索接口"))
                .andExpect(jsonPath("$.data.hits[0].explanation")
                        .value(org.hamcrest.Matchers.startsWith("向量余弦 ")));

        mvc.perform(post("/api/kb/v1/knowledgeBase/retrieve")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"query\":\"Elasticsearch\",\"mode\":\"bm25\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("当前只开放向量（dense）检索"));

        mvc.perform(post("/api/kb/v1/knowledgeBase/retrieve")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("检索参数不合法"));

        mvc.perform(post("/api/kb/v1/knowledgeBase/retrieve")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"missing-" + UUID.randomUUID() + "\",\"query\":\"Elasticsearch\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
        assertFalse(kbId.isEmpty());
    }
}
