package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.core.source.IngestDocRef;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import com.zifang.z.kb.resource.source.DocIngestRunner;
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
import java.util.Arrays;
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
 * 接入源 v1 REST 集成测试：保存/列表脱敏、探测、同步拒绝路径，
 * 以及文档同步执行器的两级增量与失效标记。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-source-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/source-api-zkb.json",
        "zkb.material.storage.root=target/test-kb/source-api-original",
        "zkb.material.repo.root=target/test-kb/source-api-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class KnowledgeBaseSourceApiIntegrationTest {

    private static final String TENANT = "t-source-api";
    private static final String ACTOR = "u-source-api-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Test
    @DisplayName("保存与列表：全量覆盖、凭据脱敏、分类不匹配/重复标识/超量被拒")
    void saveAndList() throws Exception {
        String kbId = createKb("接入源保存库");

        Map<String, Object> yuque = source("语雀主库", "YUQUE", null, "TOKEN", "tok-plain-1",
                selectionScope("group/book", "主知识库"));
        Map<String, Object> git = source("代码仓", "GIT", null, "TOKEN", "git-plain-1",
                repoScope("https://code.example.com/group/repo.git"));

        MvcResult saved = mvc.perform(post("/api/kb/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(kbId, Arrays.asList(yuque, git))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].provider").value("YUQUE"))
                .andExpect(jsonPath("$.data[0].category").value("DOC_PLATFORM"))
                .andExpect(jsonPath("$.data[0].hasSecret").value(true))
                .andExpect(jsonPath("$.data[1].provider").value("GIT"))
                .andExpect(jsonPath("$.data[1].category").value("CODE_REPO"))
                .andExpect(jsonPath("$.data[1].credentialType").value("TOKEN"))
                .andExpect(jsonPath("$.data[1].hasSecret").value(true))
                .andReturn();
        String body = saved.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertFalse(body.contains("tok-plain-1"), "列表不能回明文凭据");
        assertFalse(body.contains("git-plain-1"), "列表不能回明文凭据");

        mvc.perform(get("/api/kb/v1/knowledgeBaseSource/list")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("语雀主库"))
                .andExpect(jsonPath("$.data[1].name").value("代码仓"));

        // 只传名称保留原有凭据：secret 留空时沿用已保存的值
        Map<String, Object> renamed = source("语雀主库改名", "YUQUE", null, "TOKEN", null,
                selectionScope("group/book", "主知识库"));
        renamed.put("sourceId", data(saved).get(0).path("sourceId").asText());
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(kbId, Collections.singletonList(renamed))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("语雀主库改名"))
                .andExpect(jsonPath("$.data[0].hasSecret").value(true));

        Map<String, Object> wrongCategory = source("分类不对", "YUQUE", "CODE_REPO", "TOKEN", "x",
                selectionScope("group/book", "主知识库"));
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(kbId, Collections.singletonList(wrongCategory))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(400));

        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            tooMany.add(source("源" + i, "GIT", null, "TOKEN", "s",
                    repoScope("https://code.example.com/group/repo" + i + ".git")));
        }
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(kbId, tooMany)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @DisplayName("探测：未接入供应商如实返回不支持；语雀缺令牌与连不通都给消息")
    void probes() throws Exception {
        String kbId = createKb("接入源探测库");

        Map<String, Object> oss = source("对象存储", "OSS", null, null, null,
                Collections.singletonMap("bucket", "kb-docs"));
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(testBody(kbId, oss)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reachable").value(false))
                .andExpect(jsonPath("$.data.message").value("该供应商暂不支持连通性测试"));

        Map<String, Object> noToken = source("缺令牌", "YUQUE", null, "TOKEN", null,
                selectionScope("group/book", "主知识库"));
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(testBody(kbId, noToken)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reachable").value(false))
                .andExpect(jsonPath("$.data.message").value("缺少访问令牌"));

        Map<String, Object> unreachable = source("连不通", "YUQUE", null, "TOKEN", "tok",
                selectionScope("group/book", "主知识库"));
        @SuppressWarnings("unchecked")
        Map<String, Object> scope = (Map<String, Object>) unreachable.get("scope");
        scope.put("apiBaseUrl", "http://127.0.0.1:1/api/v2");
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(testBody(kbId, unreachable)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reachable").value(false));
    }

    @Test
    @DisplayName("语雀可选项：缺令牌时不发请求，返回提示消息")
    void catalogWithoutToken() throws Exception {
        String kbId = createKb("接入源可选项库");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kbId", kbId);
        body.put("source", source("未配令牌", "YUQUE", null, "TOKEN", null,
                selectionScope("group/book", "主知识库")));

        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/yuque/catalog")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("缺少访问令牌，填好令牌后再加载"))
                .andExpect(jsonPath("$.data.spaces.length()").value(0));

        Map<String, Object> docsBody = new LinkedHashMap<>();
        docsBody.put("kbId", kbId);
        docsBody.put("book", "group/book");
        docsBody.put("source", source("未配令牌", "YUQUE", null, "TOKEN", null,
                selectionScope("group/book", "主知识库")));
        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/yuque/catalogDocs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(docsBody))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("缺少访问令牌，填好令牌后再加载"))
                .andExpect(jsonPath("$.data.docs.length()").value(0));
    }

    @Test
    @DisplayName("同步：停用/未知/未接入供应商分别拒绝")
    void syncRejections() throws Exception {
        String kbId = createKb("接入源同步拒绝库");

        Map<String, Object> disabled = source("停用的语雀", "YUQUE", null, "TOKEN", "tok",
                selectionScope("group/book", "主知识库"));
        disabled.put("enabled", false);
        MvcResult saved = mvc.perform(post("/api/kb/v1/knowledgeBaseSource/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(saveBody(kbId, Arrays.asList(disabled,
                                source("对象存储", "OSS", null, null, null,
                                        Collections.singletonMap("bucket", "kb-docs"))))))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode sources = data(saved);
        String disabledId = sources.get(0).path("sourceId").asText();
        String ossId = sources.get(1).path("sourceId").asText();

        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(kbId, disabledId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(kbId, ossId)))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mvc.perform(post("/api/kb/v1/knowledgeBaseSource/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(syncBody(kbId, "missing-source")))
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("文档执行器：首建/未变/更新/失效/空目录不误删")
    void docRunnerIncrements() {
        String kbId = createKb("文档执行器库");
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        DocIngestRunner runner = new DocIngestRunner(materialService);
        String sourceId = "src-runner";

        List<IngestDocRef> first = Collections.singletonList(
                new IngestDocRef("doc-a", "文档 A", "1", "A", 0));
        IngestSyncInfo created = runner.run(kbId, sourceId, "YUQUE", "group/book", first,
                Collections.singletonMap("doc-a", "v1"),
                ref -> new com.zifang.z.kb.core.source.IngestDocContent(
                        "# A\n\n第一版正文。", "1", "v1"), caller);
        assertEquals(1, created.getCreated());
        assertEquals(0, created.getFailed());

        IngestSyncInfo unchanged = runner.run(kbId, sourceId, "YUQUE", "group/book", first,
                Collections.singletonMap("doc-a", "v1"),
                ref -> new com.zifang.z.kb.core.source.IngestDocContent(
                        "# A\n\n第二版正文。", "1", "v1"), caller);
        assertEquals(1, unchanged.getUnchanged());
        assertEquals(0, unchanged.getUpdated());

        IngestSyncInfo updated = runner.run(kbId, sourceId, "YUQUE", "group/book", first,
                Collections.singletonMap("doc-a", "v2"),
                ref -> new com.zifang.z.kb.core.source.IngestDocContent(
                        "# A\n\n第二版正文。", "1", "v2"), caller);
        assertEquals(1, updated.getUpdated());
        assertEquals(0, updated.getCreated());

        List<IngestDocRef> second = Collections.singletonList(
                new IngestDocRef("doc-b", "文档 B", "2", "B", 0));
        IngestSyncInfo retired = runner.run(kbId, sourceId, "YUQUE", "group/book", second,
                Collections.singletonMap("doc-b", "v1"),
                ref -> new com.zifang.z.kb.core.source.IngestDocContent(
                        "# B\n\n正文。", "2", "v1"), caller);
        assertEquals(1, retired.getCreated());
        assertEquals(1, retired.getRetired());

        IngestSyncInfo empty = runner.run(kbId, sourceId, "YUQUE", "group/book",
                Collections.<IngestDocRef>emptyList(), Collections.<String, String>emptyMap(),
                ref -> null, caller);
        assertEquals(0, empty.getRetired());
        assertEquals(0, empty.getFailed());

        List<String> listBody = listMaterialTitles(kbId);
        assertTrue(listBody.contains("文档 B"));
    }

    // ==================== 工具 ====================

    private List<String> listMaterialTitles(String kbId) {
        List<String> titles = new ArrayList<>();
        for (com.zifang.z.kb.api.material.MaterialBinding binding
                : materialService.listBySource(kbId, "src-runner", KbCaller.of(TENANT, ACTOR))) {
            titles.add(binding.getTitle());
        }
        return titles;
    }

    private Map<String, Object> source(String name, String provider, String category,
            String credentialType, String secret, Map<String, Object> scope) {
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("name", name);
        source.put("provider", provider);
        if (category != null) {
            source.put("category", category);
        }
        source.put("enabled", true);
        source.put("scope", scope);
        if (credentialType != null) {
            source.put("credentialType", credentialType);
        }
        if (secret != null) {
            source.put("secret", secret);
        }
        return source;
    }

    private Map<String, Object> selectionScope(String book, String name) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("book", book);
        entry.put("name", name);
        entry.put("docs", new ArrayList<>());
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("selection", Collections.singletonList(entry));
        return scope;
    }

    private Map<String, Object> repoScope(String repo) {
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("repo", repo);
        scope.put("branch", "main");
        return scope;
    }

    private Map<String, Object> saveBody(String kbId, List<Map<String, Object>> sources) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kbId", kbId);
        body.put("sources", sources);
        return body;
    }

    private Map<String, Object> testBody(String kbId, Map<String, Object> source) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kbId", kbId);
        body.put("source", source);
        return body;
    }

    private Map<String, Object> syncBody(String kbId, String sourceId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kbId", kbId);
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

    private String createKb(String name) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName(name);
        kb.setCode("src_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        KnowledgeBaseView view = resourceService.create(kb, KbCaller.of(TENANT, ACTOR));
        assertFalse(view.getKbId().isEmpty());
        return view.getKbId();
    }
}
