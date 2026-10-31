package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadFile;
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
 * Wiki 域 v1 REST 集成测试：规则生成、Agent 产物幂等写入与血缘。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-wiki-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/wiki-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/wiki-api-original",
        "zkb.material.repo.root=target/test-kb/wiki-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class WikiApiIntegrationTest {

    private static final String TENANT = "t-wiki-api";
    private static final String ACTOR = "u-wiki-api-owner";

    private static final String NOTE = "图谱为本地规则抽取，仅用于召回定位。";

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
    @DisplayName("规则生成：建页/幂等/换版升版/列表检索/详情要点/血缘图谱")
    void ruleGenerationAndLineage() throws Exception {
        String kbId = createKb("Wiki 规则库");
        String materialId = registerText(kbId, "Wiki 接口物料",
                "# 检索增强\n\n检索增强依赖向量索引。\n\n## 图谱\n\n知识库需要图谱。");

        MvcResult generated = mvc.perform(post("/api/kb/v1/wiki/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "materialIds", List.of(materialId))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.totalCount").value(1))
                .andExpect(jsonPath("$.data.successCount").value(1))
                .andExpect(jsonPath("$.data.failedCount").value(0))
                .andExpect(jsonPath("$.data.items[0].materialId").value(materialId))
                .andExpect(jsonPath("$.data.items[0].status").value("READY"))
                .andExpect(jsonPath("$.data.items[0].title").value("Wiki 接口物料"))
                .andExpect(jsonPath("$.data.items[0].versionNo").value(1))
                .andReturn();
        String wikiId = data(generated).path("items").get(0).path("wikiId").asText();
        assertFalse(wikiId.isEmpty());

        mvc.perform(post("/api/kb/v1/wiki/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "materialIds", List.of(materialId))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].wikiId").value(wikiId))
                .andExpect(jsonPath("$.data.items[0].versionNo").value(1));

        mvc.perform(get("/api/kb/v1/wiki/list")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].wikiId").value(wikiId))
                .andExpect(jsonPath("$.data[0].title").value("Wiki 接口物料"))
                .andExpect(jsonPath("$.data[0].summary").value("检索增强依赖向量索引。"))
                .andExpect(jsonPath("$.data[0].pointCount").value(2))
                .andExpect(jsonPath("$.data[0].sourceCount").value(1))
                .andExpect(jsonPath("$.data[0].status").value("READY"));

        mvc.perform(get("/api/kb/v1/wiki/list")
                        .param("kbId", kbId)
                        .param("keyword", "向量索引")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(get("/api/kb/v1/wiki/list")
                        .param("kbId", kbId)
                        .param("keyword", "不存在的关键词")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", wikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page.wikiId").value(wikiId))
                .andExpect(jsonPath("$.data.page.materialId").value(materialId))
                .andExpect(jsonPath("$.data.points.length()").value(2))
                .andExpect(jsonPath("$.data.points[0].heading").value("检索增强"))
                .andExpect(jsonPath("$.data.points[0].text").value("检索增强依赖向量索引。"))
                .andExpect(jsonPath("$.data.points[1].heading").value("图谱"))
                .andExpect(jsonPath("$.data.sources.length()").value(1))
                .andExpect(jsonPath("$.data.sources[0].materialId").value(materialId))
                .andExpect(jsonPath("$.data.sources[0].materialTitle").value("Wiki 接口物料.md"))
                .andExpect(jsonPath("$.data.graphNodeCount").value(0))
                .andExpect(jsonPath("$.data.note").value(NOTE));

        mvc.perform(get("/api/kb/v1/wiki/listByMaterial")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].wikiId").value(wikiId));

        mvc.perform(get("/api/kb/v1/wiki/listByMaterial")
                        .param("materialId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        compilationService.run(materialId, null, KbCaller.of(TENANT, ACTOR));

        MvcResult detail = mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", wikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        int graphNodeCount = data(detail).path("graphNodeCount").asInt();
        assertTrue(graphNodeCount >= 2, "详情应带图谱节点数：" + graphNodeCount);

        MvcResult lineage = mvc.perform(get("/api/kb/v1/wiki/lineage")
                        .param("wikiId", wikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.wikiId").value(wikiId))
                .andExpect(jsonPath("$.data.title").value("Wiki 接口物料"))
                .andExpect(jsonPath("$.data.sourceCount").value(1))
                .andExpect(jsonPath("$.data.relationTypes[0]").value("SOURCED_FROM"))
                .andExpect(jsonPath("$.data.note").value(NOTE))
                .andReturn();
        JsonNode lineageData = data(lineage);
        assertTrue(lineageData.path("graphNodeCount").asInt() >= 2);
        boolean hasWikiNode = false;
        boolean hasMaterialNode = false;
        boolean hasConceptNode = false;
        boolean hasSourcedFrom = false;
        for (JsonNode node : lineageData.path("nodes")) {
            String nodeId = node.path("nodeId").asText();
            hasWikiNode |= ("wiki:" + wikiId).equals(nodeId);
            hasMaterialNode |= ("material:" + materialId).equals(nodeId);
            hasConceptNode |= "CONCEPT".equals(node.path("nodeType").asText());
        }
        for (JsonNode edge : lineageData.path("edges")) {
            hasSourcedFrom |= "SOURCED_FROM".equals(edge.path("relation").asText());
        }
        assertTrue(hasWikiNode, "血缘缺少 Wiki 节点");
        assertTrue(hasMaterialNode, "血缘缺少物料节点");
        assertTrue(hasConceptNode, "血缘缺少图谱概念节点");
        assertTrue(hasSourcedFrom, "血缘缺少 SOURCED_FROM 关系");

        mvc.perform(get("/api/kb/v1/wiki/lineage")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("库内 Wiki 血缘"))
                .andExpect(jsonPath("$.data.sourceCount").value(1));

        byte[] revised = ("# 检索增强\n\n检索增强还依赖重排序。\n\n## 图谱\n\n图谱由节点和边组成。")
                .getBytes(StandardCharsets.UTF_8);
        MaterialUploadItem revisedItem = materialService.revise(kbId, materialId,
                new MaterialUploadFile("revised.md", revised.length, revised), null,
                KbCaller.of(TENANT, ACTOR));
        assertTrue(revisedItem.isSuccess(), revisedItem.getMessage());

        mvc.perform(post("/api/kb/v1/wiki/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "materialIds", List.of(materialId))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].wikiId").value(wikiId))
                .andExpect(jsonPath("$.data.items[0].versionNo").value(2));

        mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", wikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page.versionNo").value(2))
                .andExpect(jsonPath("$.data.points[0].text").value("检索增强还依赖重排序。"))
                .andExpect(jsonPath("$.data.sources[0].sourceVersionNo").value(2));
    }

    @Test
    @DisplayName("Agent 产物：多页幂等写入、目录版本、块覆盖与过期页物理删除")
    void agentDocWriteAndQuery() throws Exception {
        String kbId = createKb("Wiki Agent 库");
        String materialId = registerText(kbId, "Agent 编译物料", "# 简介\n\nAgent 编译正文。");

        mvc.perform(get("/api/kb/v1/wiki/queryGenerated")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").doesNotExist());

        Map<String, Object> param = new LinkedHashMap<>();
        param.put("kbId", kbId);
        param.put("materialId", materialId);
        param.put("indexMd", "- [简介](intro)\n- [图谱](graph)");
        param.put("generator", "AGENT");
        param.put("pages", List.of(
                page("intro", "简介", "简介摘要", "## 简介\n\n简介正文。", List.of("c1", "c2")),
                page("graph", "图谱", null, "图谱页面正文。", List.of("c3"))));

        MvcResult saved = mvc.perform(post("/api/kb/v1/wiki/saveGenerated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(param))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pageCount").value(2))
                .andExpect(jsonPath("$.data.chunkCount").value(3))
                .andExpect(jsonPath("$.data.coveredChunkCount").value(3))
                .andExpect(jsonPath("$.data.versionNo").value(1))
                .andExpect(jsonPath("$.data.generator").value("AGENT"))
                .andExpect(jsonPath("$.data.pages.length()").value(2))
                .andExpect(jsonPath("$.data.pages[0].slug").value("intro"))
                .andExpect(jsonPath("$.data.pages[0].summary").value("简介摘要"))
                .andExpect(jsonPath("$.data.pages[0].chunkIds.length()").value(2))
                .andExpect(jsonPath("$.data.pages[1].slug").value("graph"))
                .andExpect(jsonPath("$.data.pages[1].summary").value("图谱页面正文。"))
                .andReturn();
        JsonNode savedData = data(saved);
        String introWikiId = savedData.path("pages").get(0).path("wikiId").asText();
        String graphWikiId = savedData.path("pages").get(1).path("wikiId").asText();

        mvc.perform(get("/api/kb/v1/wiki/queryGenerated")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pageCount").value(2))
                .andExpect(jsonPath("$.data.generator").value("AGENT"))
                .andExpect(jsonPath("$.data.indexMd").value("- [简介](intro)\n- [图谱](graph)"))
                .andExpect(jsonPath("$.data.pages.length()").value(2));

        mvc.perform(post("/api/kb/v1/wiki/saveGenerated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(param))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.versionNo").value(1))
                .andExpect(jsonPath("$.data.pages[0].versionNo").value(1))
                .andExpect(jsonPath("$.data.pages[0].wikiId").value(introWikiId));

        Map<String, Object> changed = new LinkedHashMap<>();
        changed.put("kbId", kbId);
        changed.put("materialId", materialId);
        changed.put("indexMd", "- [简介](intro)");
        changed.put("generator", "AGENT");
        changed.put("pages", List.of(
                page("intro", "简介", null, "## 简介\n\n简介正文已更新。", List.of("c1"))));

        mvc.perform(post("/api/kb/v1/wiki/saveGenerated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(changed))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pageCount").value(1))
                .andExpect(jsonPath("$.data.versionNo").value(2))
                .andExpect(jsonPath("$.data.pages[0].versionNo").value(2))
                .andExpect(jsonPath("$.data.pages[0].wikiId").value(introWikiId));

        mvc.perform(get("/api/kb/v1/wiki/queryGenerated")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pageCount").value(1))
                .andExpect(jsonPath("$.data.pages[0].slug").value("intro"));

        mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", graphWikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Wiki 页面不存在"));

        mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", introWikiId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page.versionNo").value(2))
                .andExpect(jsonPath("$.data.points[0].text").value("简介正文已更新。"));

        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("kbId", kbId);
        empty.put("materialId", materialId);
        empty.put("pages", List.of());
        mvc.perform(post("/api/kb/v1/wiki/saveGenerated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(empty))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wiki 参数不合法"));
    }

    @Test
    @DisplayName("编译入口同步返回终态任务句柄；参数错误 400、不存在 404")
    void compileHandleAndErrorMapping() throws Exception {
        String kbId = createKb("Wiki 编译库");
        String materialId = registerText(kbId, "编译任务物料", "# 编译\n\n编译正文。");

        MvcResult compiled = mvc.perform(post("/api/kb/v1/wiki/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "materialId", materialId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.taskType").value("WIKI_COMPILE"))
                .andExpect(jsonPath("$.data.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.data.bizId").value(materialId))
                .andReturn();
        JsonNode task = data(compiled);
        String taskId = task.path("taskId").asText();
        assertFalse(taskId.isEmpty());
        assertFalse(task.path("bizKey").asText().isEmpty());

        mvc.perform(get("/api/kb/v1/wiki/listByMaterial")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].wikiId").value(taskId));

        mvc.perform(post("/api/kb/v1/wiki/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId, "materialId", " ")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wiki 参数不合法"));

        mvc.perform(post("/api/kb/v1/wiki/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", " ", "materialIds", List.of(materialId))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mvc.perform(post("/api/kb/v1/wiki/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", "missing-" + UUID.randomUUID(),
                                "materialIds", List.of(materialId))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));

        mvc.perform(get("/api/kb/v1/wiki/list")
                        .param("kbId", " ")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("知识库参数不合法"));

        mvc.perform(get("/api/kb/v1/wiki/detail")
                        .param("wikiId", "missing-" + UUID.randomUUID())
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Wiki 页面不存在"));

        mvc.perform(post("/api/kb/v1/wiki/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("kbId", kbId,
                                "materialId", "missing-" + UUID.randomUUID())))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    private Map<String, Object> page(String slug, String title, String summary, String content,
                                     List<String> chunkIds) {
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("slug", slug);
        page.put("title", title);
        if (summary != null) {
            page.put("summary", summary);
        }
        page.put("content", content);
        page.put("chunkIds", new ArrayList<>(chunkIds));
        return page;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode data(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        return objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8)).path("data");
    }

    private String createKb(String name) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName(name);
        kb.setCode("wiki_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
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
