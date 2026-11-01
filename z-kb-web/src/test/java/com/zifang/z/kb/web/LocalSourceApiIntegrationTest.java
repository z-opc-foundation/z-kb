package com.zifang.z.***REMOVED***.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.***REMOVED***.api.material.MaterialBinding;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBase;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseType;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
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
 * 本地目录接入源端到端集成测试。
 *
 * <p>这是「note 的文件夹可以直接当 z-***REMOVED*** 的接入源」这句话的落地验收：
 * 保存一个本地接入源 → 探测能通 → 同步真的把目录里的笔记登记成物料 →
 * 再次同步判定为未变 → 文件删了会被标记失效。
 *
 * <p>守住的核心是「文件出现即入库」这条语义：语雀、Git 这些接入源都要人去
 * 网页上传或推代码，本地接入源的口径是文件落在目录里就已经在库里。
 */
@SpringBootTest(classes = ***REMOVED***ApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:z***REMOVED***-local-source-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "z***REMOVED***.storage.path=target/test-***REMOVED***/local-source-api-z***REMOVED***.json",
        "z***REMOVED***.material.storage.root=target/test-***REMOVED***/local-source-api-original",
        "z***REMOVED***.material.repo.root=target/test-***REMOVED***/local-source-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class LocalSourceApiIntegrationTest {

    private static final String TENANT = "t-local-source-api";
    private static final String ACTOR = "u-local-source-api-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Test
    @DisplayName("本地接入源：保存免凭据 → 探测可读 → 同步入库 → 再同步未变")
    void localSourceSyncsDirectory() throws Exception {
        String ***REMOVED***Id = create***REMOVED***("本地接入源库");
        Path dir = Files.createTempDirectory("z***REMOVED***-local-note-");
        write(dir, "部署.md", "# 部署\n\n部署步骤在这里。\n");
        write(dir, "运维/监控.md", "# 监控\n\n监控指标在这里。\n");

        Map<String, Object> source = localSource("我的笔记目录", dir.toString());

        // 保存：本地接入源不需要任何凭据
        MvcResult saved = mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(***REMOVED***Id, Collections.singletonList(source))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].provider").value("LOCAL"))
                .andExpect(jsonPath("$.data[0].category").value("FILE_SHARE"))
                .andExpect(jsonPath("$.data[0].credentialType").value("NONE"))
                .andExpect(jsonPath("$.data[0].hasSecret").value(false))
                .andReturn();
        String sourceId = data(saved).get(0).path("sourceId").asText();

        // 探测：目录可读即连通，并报出扫到几篇
        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(testBody(***REMOVED***Id, localSource("我的笔记目录", dir.toString()))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reachable").value(true))
                .andExpect(jsonPath("$.data.message").value("连接成功（扫到 2 篇 Markdown）"));

        // 同步：两篇笔记都登记成物料
        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.created").value(2))
                .andExpect(jsonPath("$.data.failed").value(0));

        List<String> titles = listMaterialTitles(***REMOVED***Id, sourceId);
        assertTrue(titles.contains("部署"), "应登记《部署》，实际：" + titles);
        assertTrue(titles.contains("监控"), "应登记《监控》，实际：" + titles);

        // 再同步：内容没变 → 全部未变，不重写物料
        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unchanged").value(2))
                .andExpect(jsonPath("$.data.updated").value(0))
                .andExpect(jsonPath("$.data.created").value(0));
    }

    @Test
    @DisplayName("本地接入源：工具产物目录不入库（与桌面端 note 同源）")
    void localSourceSkipsToolDirs() throws Exception {
        String ***REMOVED***Id = create***REMOVED***("本地接入源排除库");
        Path dir = Files.createTempDirectory("z***REMOVED***-local-tool-");
        write(dir, "主库/笔记.md", "# 主库笔记\n\n正文。\n");
        write(dir, ".worktrees/fork-x/笔记.md", "# 副本\n\n正文。\n");
        write(dir, "node_modules/pkg/readme.md", "# readme\n\n正文。\n");

        Map<String, Object> source = localSource("带工具目录的目录", dir.toString());
        MvcResult saved = mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(***REMOVED***Id, Collections.singletonList(source))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        String sourceId = data(saved).get(0).path("sourceId").asText();

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.created").value(1));

        List<String> titles = listMaterialTitles(***REMOVED***Id, sourceId);
        assertEquals(1, titles.size(), "只应收主库那篇，实际：" + titles);
        assertTrue(titles.contains("主库笔记"), "应收的应是主库笔记，实际：" + titles);
    }

    @Test
    @DisplayName("本地接入源：目录不存在时探测与同步都拒绝")
    void localSourceRejectsMissingDir() throws Exception {
        String ***REMOVED***Id = create***REMOVED***("本地接入源缺目录库");
        Path missing = Files.createTempDirectory("z***REMOVED***-local-missing-").resolve("不存在");

        Map<String, Object> source = localSource("不存在的目录", missing.toString());
        MvcResult saved = mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(***REMOVED***Id, Collections.singletonList(source))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        String sourceId = data(saved).get(0).path("sourceId").asText();

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(testBody(***REMOVED***Id, localSource("不存在的目录", missing.toString()))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reachable").value(false));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("本地接入源：目录里的文件删掉后被标记失效")
    void localSourceRetiresDeletedFiles() throws Exception {
        String ***REMOVED***Id = create***REMOVED***("本地接入源失效库");
        Path dir = Files.createTempDirectory("z***REMOVED***-local-retire-");
        write(dir, "保留.md", "# 保留\n\n正文。\n");
        write(dir, "删除.md", "# 删除\n\n正文。\n");

        Map<String, Object> source = localSource("待删文件的目录", dir.toString());
        MvcResult saved = mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(***REMOVED***Id, Collections.singletonList(source))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        String sourceId = data(saved).get(0).path("sourceId").asText();

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.created").value(2));

        Files.delete(dir.resolve("删除.md"));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(***REMOVED***Id, sourceId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.retired").value(1))
                .andExpect(jsonPath("$.data.failed").value(0));
    }

    // ==================== 工具 ====================

    private List<String> listMaterialTitles(String ***REMOVED***Id, String sourceId) {
        List<String> titles = new ArrayList<>();
        for (MaterialBinding binding : materialService.listBySource(***REMOVED***Id, sourceId,
                ***REMOVED***Caller.of(TENANT, ACTOR))) {
            titles.add(binding.getTitle());
        }
        return titles;
    }

    private Map<String, Object> localSource(String name, String path) {
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("path", path);
        scope.put("recursive", Boolean.TRUE);

        Map<String, Object> source = new LinkedHashMap<>();
        source.put("name", name);
        source.put("provider", "LOCAL");
        source.put("enabled", true);
        source.put("scope", scope);
        return source;
    }

    private Map<String, Object> saveBody(String ***REMOVED***Id, List<Map<String, Object>> sources) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("***REMOVED***Id", ***REMOVED***Id);
        body.put("sources", sources);
        return body;
    }

    private Map<String, Object> testBody(String ***REMOVED***Id, Map<String, Object> source) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("***REMOVED***Id", ***REMOVED***Id);
        body.put("source", source);
        return body;
    }

    private Map<String, Object> syncBody(String ***REMOVED***Id, String sourceId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("***REMOVED***Id", ***REMOVED***Id);
        body.put("sourceId", sourceId);
        return body;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode data(MvcResult result) throws Exception {
        byte[] bytes = result.getResponse().getContentAsByteArray();
        return objectMapper.readTree(new String(bytes, StandardCharsets.UTF_8)).path("data");
    }

    private void write(Path root, String relative, String content) throws Exception {
        Path file = root.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.write(file, content.getBytes(StandardCharsets.UTF_8));
    }

    private String create***REMOVED***(String name) {
        KnowledgeBase ***REMOVED*** = new KnowledgeBase();
        ***REMOVED***.setName(name);
        ***REMOVED***.setCode("loc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        ***REMOVED***.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(***REMOVED***, ***REMOVED***Caller.of(TENANT, ACTOR));
        assertFalse(view.get***REMOVED***Id().isEmpty());
        return view.get***REMOVED***Id();
    }
}
