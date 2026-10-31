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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 萃取 / 概念 / 图谱三个 v1 REST 域的集成测试：编译 P4 落库后由接口读回。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-extraction-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/extraction-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/extraction-api-original",
        "zkb.material.repo.root=target/test-kb/extraction-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class ExtractionConceptGraphApiIntegrationTest {

    private static final String TENANT = "t-extract-api";
    private static final String ACTOR = "u-extract-api-owner";

    private static final String DOC = "# 检索增强\n\n检索增强依赖向量索引。向量索引可以加速知识检索。"
            + "知识库需要图谱。";

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
    @DisplayName("编译 P4 后萃取产物/概念模型/图谱均可读回，且跨物料概念合并为已确认")
    void extractionConceptGraphHappyPath() throws Exception {
        String kbId = createKb();
        String materialId = registerText(kbId, "萃取接口物料", DOC);
        compilationService.run(materialId, null, KbCaller.of(TENANT, ACTOR));

        MvcResult extracted = mvc.perform(get("/api/kb/v1/extraction/queryByMaterial")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.materialId").value(materialId))
                .andExpect(jsonPath("$.data.milestone").value("M2"))
                .andExpect(jsonPath("$.data.counts.summary").value(1))
                .andExpect(jsonPath("$.data.counts.question").value(2))
                .andExpect(jsonPath("$.data.counts.faq").value(1))
                .andExpect(jsonPath("$.data.summary.itemType").value("SUMMARY"))
                .andExpect(jsonPath("$.data.questions[0].itemType").value("QUESTION"))
                .andExpect(jsonPath("$.data.faqs[0].itemType").value("FAQ"))
                .andReturn();
        JsonNode data = data(extracted);
        assertFalse(data.path("materialVersionId").asText().isEmpty());
        int termCount = data.path("counts").path("term").asInt();
        assertEquals(termCount, data.path("terms").size());
        assertTrue(termCount >= 3 && termCount <= 5, "术语数应在 3~5：" + termCount);
        assertTrue(data.path("counts").path("graphNode").asInt() >= 2);
        assertTrue(data.path("counts").path("graphEdge").asInt() >= 2);

        MvcResult concepts = mvc.perform(get("/api/kb/v1/concept/listByKb")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();
        JsonNode conceptList = data(concepts);
        assertTrue(conceptList.size() >= 2, "概念列表应至少包含标题与术语：" + conceptList);
        JsonNode target = null;
        for (JsonNode item : conceptList) {
            if ("检索增强".equals(item.path("name").asText())) {
                target = item;
            }
        }
        assertTrue(target != null, "缺少概念：检索增强，实际：" + conceptList);
        assertEquals("TERM", target.path("conceptType").asText());
        assertEquals("EMERGING", target.path("status").asText());
        assertEquals(1, target.path("materialCount").asInt());
        assertTrue(target.path("mentionCount").asInt() >= 1);
        assertEquals("concept:" + target.path("conceptId").asText(),
                target.path("graphNodeId").asText());
        String conceptId = target.path("conceptId").asText();

        mvc.perform(get("/api/kb/v1/concept/listByKb")
                        .param("kbId", kbId)
                        .param("keyword", "不存在的关键词")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mvc.perform(get("/api/kb/v1/concept/queryById")
                        .param("kbId", kbId)
                        .param("conceptId", conceptId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.concept.conceptId").value(conceptId))
                .andExpect(jsonPath("$.data.concept.name").value("检索增强"))
                .andExpect(jsonPath("$.data.mentions.length()").value(1))
                .andExpect(jsonPath("$.data.mentions[0].materialId").value(materialId))
                .andExpect(jsonPath("$.data.mentions[0].materialTitle").value("萃取接口物料.md"))
                .andExpect(jsonPath("$.data.mentions[0].chunkOrdinal").value(1));

        MvcResult graph = mvc.perform(get("/api/kb/v1/graph/queryByKb")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kbId").value(kbId))
                .andExpect(jsonPath("$.data.graphSpaceKey").value("kb:" + kbId))
                .andExpect(jsonPath("$.data.truncated").value(false))
                .andReturn();
        JsonNode graphView = data(graph);
        int nodeCount = graphView.path("nodeCount").asInt();
        int edgeCount = graphView.path("edgeCount").asInt();
        assertEquals(nodeCount, graphView.path("nodes").size());
        assertEquals(edgeCount, graphView.path("edges").size());
        assertTrue(nodeCount >= 2);
        assertTrue(edgeCount >= 2);
        boolean hasMaterialNode = false;
        boolean hasConceptNode = false;
        boolean hasMentionsEdge = false;
        for (JsonNode node : graphView.path("nodes")) {
            hasMaterialNode |= ("material:" + materialId).equals(node.path("nodeId").asText());
            if ("CONCEPT".equals(node.path("nodeType").asText())) {
                hasConceptNode = true;
                assertTrue(node.path("conceptId").asText().startsWith("cpt_"));
            }
        }
        for (JsonNode edge : graphView.path("edges")) {
            hasMentionsEdge |= "MENTIONS".equals(edge.path("edgeType").asText());
        }
        assertTrue(hasMaterialNode);
        assertTrue(hasConceptNode);
        assertTrue(hasMentionsEdge);

        MvcResult byMaterial = mvc.perform(get("/api/kb/v1/graph/queryByMaterial")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kbId").value(kbId))
                .andReturn();
        JsonNode materialGraph = data(byMaterial);
        assertEquals(materialGraph.path("nodeCount").asInt(),
                materialGraph.path("nodes").size());
        for (JsonNode node : materialGraph.path("nodes")) {
            assertEquals(materialId, node.path("materialId").asText());
        }

        String secondMaterialId = registerText(kbId, "萃取接口物料二",
                "# 检索增强\n\n检索增强需要图谱支撑。图谱由节点与边组成。");
        compilationService.run(secondMaterialId, null, KbCaller.of(TENANT, ACTOR));

        MvcResult merged = mvc.perform(get("/api/kb/v1/concept/listByKb")
                        .param("kbId", kbId)
                        .param("keyword", "检索增强")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode mergedList = data(merged);
        assertEquals(1, mergedList.size());
        assertEquals(2, mergedList.get(0).path("materialCount").asInt());
        assertEquals("CONFIRMED", mergedList.get(0).path("status").asText());
        assertEquals(conceptId, mergedList.get(0).path("conceptId").asText());

        mvc.perform(get("/api/kb/v1/concept/queryById")
                        .param("kbId", kbId)
                        .param("conceptId", conceptId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mentions.length()").value(2))
                .andExpect(jsonPath("$.data.concept.status").value("CONFIRMED"));

        mvc.perform(get("/api/kb/v1/graph/queryByKb")
                        .param("kbId", kbId)
                        .param("materialId", secondMaterialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kbId").value(kbId))
                .andExpect(jsonPath("$.data.nodes[*].materialId")
                        .value(org.hamcrest.Matchers.everyItem(
                                org.hamcrest.Matchers.is(secondMaterialId))));
    }

    @Test
    @DisplayName("错误映射：空参数 400、物料不存在 404、概念不存在 404、知识库不存在 404")
    void errorStatusMapping() throws Exception {
        mvc.perform(get("/api/kb/v1/extraction/queryByMaterial")
                        .param("materialId", " ")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("物料参数不合法"));

        mvc.perform(get("/api/kb/v1/extraction/queryByMaterial")
                        .param("materialId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));

        mvc.perform(get("/api/kb/v1/graph/queryByMaterial")
                        .param("materialId", " ")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("物料参数不合法"));

        mvc.perform(get("/api/kb/v1/graph/queryByKb")
                        .param("kbId", " ")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("知识库参数不合法"));

        mvc.perform(get("/api/kb/v1/graph/queryByKb")
                        .param("kbId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));

        String kbId = createKb();
        mvc.perform(get("/api/kb/v1/concept/queryById")
                        .param("kbId", kbId)
                        .param("conceptId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("概念不存在"));

        mvc.perform(get("/api/kb/v1/concept/listByKb")
                        .param("kbId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    private JsonNode data(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        return objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8)).path("data");
    }

    private String createKb() {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("萃取接口库");
        kb.setCode("extapi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, KbCaller.of(TENANT, ACTOR));
        assertFalse(view.getKbId().isEmpty());
        return view.getKbId();
    }

    private String registerText(String kbId, String title, String content) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null, content,
                KbCaller.of(TENANT, ACTOR));
        assertTrue(item.isSuccess(), item.getMessage());
        return item.getMaterialId();
    }
}
