package com.zifang.z.kb.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialSyncRequest;
import com.zifang.z.kb.api.material.MaterialSyncResult;
import com.zifang.z.kb.api.resource.KbCaller;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 物料域 v1 REST 集成测试：真起 Spring 容器 + H2，按参考实现的路径与信封钉契约。
 */
@SpringBootTest(classes = KbApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-material;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.vector.storage-type=in-memory",
        "zkb.graph.engine=json",
        "zkb.graph.path=target/test-kb/graph",
        "zkb.storage.path=target/test-kb/material-zkb.json",
        "zkb.material.storage.root=target/test-kb/material-original",
        "zkb.material.repo.root=target/test-kb/material-repo",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class MaterialApiIntegrationTest {

    private static final String TENANT = "t-material";
    private static final String ACTOR = "u-material-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MaterialService materialService;

    @Test
    @DisplayName("上传→分页→详情→下载：解析同步完成，信封带 data")
    @SuppressWarnings("unchecked")
    void uploadPageDetailAndDownload() throws Exception {
        String kbId = createKb();
        String content = "# 需求\n\n物料域集成测试 " + UUID.randomUUID();
        String fileName = "req-" + UUID.randomUUID().toString().substring(0, 8) + ".md";

        Map<String, Object> item = upload(kbId, fileName, content);
        assertEquals(Boolean.TRUE, item.get("success"));
        assertEquals("READY", item.get("parseStatus"));
        String materialId = (String) item.get("materialId");

        mvc.perform(post("/api/kb/v1/material/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].materialId").value(materialId))
                .andExpect(jsonPath("$.data.records[0].parseStatus").value("READY"))
                .andExpect(jsonPath("$.data.records[0].entryType").value("DOCUMENT"));

        mvc.perform(get("/api/kb/v1/material/queryDetailById")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.material.materialId").value(materialId))
                .andExpect(jsonPath("$.data.versions.length()").value(1))
                .andExpect(jsonPath("$.data.currentDraft.status").value("READY"))
                .andExpect(jsonPath("$.data.currentDraft.textContent").value(content));

        MvcResult download = mvc.perform(get("/api/kb/v1/material/download")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        assertArrayEquals(content.getBytes(StandardCharsets.UTF_8),
                download.getResponse().getContentAsByteArray());

        mvc.perform(get("/api/kb/v1/material/listRecent")
                        .param("kbId", kbId)
                        .param("limit", "5")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].materialId").value(materialId));
    }

    @Test
    @DisplayName("重复内容：逐项返回 duplicated=true，不写入第二种物料")
    void duplicateUploadIsReported() throws Exception {
        String kbId = createKb();
        String content = "重复内容 " + UUID.randomUUID();
        String fileName = "dup-" + UUID.randomUUID().toString().substring(0, 8) + ".md";

        Map<String, Object> first = upload(kbId, fileName, content);
        assertEquals(Boolean.TRUE, first.get("success"));

        Map<String, Object> second = upload(kbId, fileName, content);
        assertEquals(Boolean.FALSE, second.get("success"));
        assertEquals(Boolean.TRUE, second.get("duplicated"));

        mvc.perform(post("/api/kb/v1/material/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    @DisplayName("新版→解析稿→人工改稿→回收站→恢复→彻底删除")
    @SuppressWarnings("unchecked")
    void revisionDraftAndRecycleBinFlow() throws Exception {
        String kbId = createKb();
        String fileName = "flow-" + UUID.randomUUID().toString().substring(0, 8) + ".md";
        Map<String, Object> item = upload(kbId, fileName, "第一版 " + UUID.randomUUID());
        String materialId = (String) item.get("materialId");

        String second = "第二版 " + UUID.randomUUID();
        mvc.perform(multipart("/api/kb/v1/material/revise")
                        .file(new MockMultipartFile("file", fileName, "text/markdown",
                                second.getBytes(StandardCharsets.UTF_8)))
                        .param("kbId", kbId)
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.parseStatus").value("READY"));

        mvc.perform(get("/api/kb/v1/material/queryDetailById")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.material.versionNo").value(2))
                .andExpect(jsonPath("$.data.versions.length()").value(2))
                .andExpect(jsonPath("$.data.currentDraft.textContent").value(second));

        mvc.perform(post("/api/kb/v1/material/saveDraftText")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materialId\":\"" + materialId + "\",\"textContent\":\"人工改稿\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.parserName").value("manual-edit"))
                .andExpect(jsonPath("$.data.textContent").value("人工改稿"));

        mvc.perform(get("/api/kb/v1/material/listDrafts")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].parserName").value("manual-edit"));

        mvc.perform(post("/api/kb/v1/material/reparse")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"materialId\":\"" + materialId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.textContent").value(second));

        mvc.perform(post("/api/kb/v1/material/remove")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"materialIds\":[\"" + materialId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].success").value(true));

        mvc.perform(post("/api/kb/v1/material/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));

        mvc.perform(post("/api/kb/v1/material/pageDeleted")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].materialId").value(materialId));

        mvc.perform(post("/api/kb/v1/material/restore")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"materialIds\":[\"" + materialId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].success").value(true));

        mvc.perform(get("/api/kb/v1/material/queryDetailById")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.material.materialStatus").value("ACTIVE"));

        mvc.perform(post("/api/kb/v1/material/remove")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"materialIds\":[\"" + materialId + "\"]}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/kb/v1/material/purge")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"materialIds\":[\"" + materialId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].success").value(true));

        mvc.perform(get("/api/kb/v1/material/queryDetailById")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("文本登记与附件登记：正文走 Markdown 文件名")
    @SuppressWarnings("unchecked")
    void registerTextAndAttachment() throws Exception {
        String kbId = createKb();
        String title = "会议纪要 " + UUID.randomUUID().toString().substring(0, 6);
        mvc.perform(post("/api/kb/v1/material/registerText")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "kbId", kbId, "title", title, "content", "# 纪要\n正文"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.fileName").value(title + ".md"))
                .andExpect(jsonPath("$.data.parseStatus").value("READY"));

        MvcResult attachment = mvc.perform(multipart("/api/kb/v1/material/attachment")
                        .file(new MockMultipartFile("file", "note.txt", "text/plain",
                                "附件正文".getBytes(StandardCharsets.UTF_8)))
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileName").value("note.txt"))
                .andExpect(jsonPath("$.data.sizeBytes").value(12))
                .andReturn();
        Map<String, Object> body = objectMapper.readValue(
                attachment.getResponse().getContentAsString(), Map.class);
        Map<String, Object> data = (Map<String, Object>) body.get("data");
        String url = (String) data.get("url");

        mvc.perform(post("/api/kb/v1/material/registerFromUrl")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "kbId", kbId, "title", "附件登记", "fileName", "note.txt",
                                "url", url))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.parseStatus").value("READY"));
    }

    @Test
    @DisplayName("分类树：三层上限、同层重名、有子分类/物料时拒绝删除、批量改分类")
    @SuppressWarnings("unchecked")
    void categoryTreeLifecycle() throws Exception {
        String kbId = createKb();
        String rootId = addCategory(kbId, null, "根目录");
        String childId = addCategory(kbId, rootId, "子目录");
        String leafId = addCategory(kbId, childId, "叶子");

        mvc.perform(post("/api/kb/v1/materialCategory/add")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"parentId\":\"" + leafId
                                + "\",\"name\":\"第四层\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mvc.perform(post("/api/kb/v1/materialCategory/add")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"parentId\":\"" + rootId
                                + "\",\"name\":\"子目录\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mvc.perform(get("/api/kb/v1/materialCategory/tree")
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].children[0].name").value("子目录"))
                .andExpect(jsonPath("$.data[0].children[0].children[0].name").value("叶子"));

        mvc.perform(post("/api/kb/v1/materialCategory/remove")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"" + rootId + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));

        mvc.perform(post("/api/kb/v1/materialCategory/update")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"" + leafId + "\",\"name\":\"新叶子\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        mvc.perform(post("/api/kb/v1/materialCategory/move")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"" + leafId + "\",\"parentId\":\"" + rootId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        String fileName = "cat-" + UUID.randomUUID().toString().substring(0, 8) + ".md";
        Map<String, Object> item = upload(kbId, fileName, "分类归属 " + UUID.randomUUID());
        String materialId = (String) item.get("materialId");

        mvc.perform(post("/api/kb/v1/material/updateCategory")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"materialIds\":[\"" + materialId
                                + "\"],\"categoryId\":\"" + childId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].success").value(true));

        mvc.perform(post("/api/kb/v1/material/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\",\"categoryId\":\"" + childId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));

        mvc.perform(post("/api/kb/v1/materialCategory/remove")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"" + childId + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));

        String emptyId = addCategory(kbId, null, "空目录");
        mvc.perform(post("/api/kb/v1/materialCategory/remove")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"" + emptyId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
    }

    @Test
    @DisplayName("仓库浏览：非仓库物料与未知物料均 404，路径非法 400")
    void repoBrowseRejectsUnsupportedMaterial() throws Exception {
        String kbId = createKb();
        Map<String, Object> item = upload(kbId, "plain-" + UUID.randomUUID().toString()
                .substring(0, 8) + ".md", "普通物料 " + UUID.randomUUID());
        String materialId = (String) item.get("materialId");

        mvc.perform(get("/api/kb/v1/material/repo/overview")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));

        mvc.perform(get("/api/kb/v1/material/repo/tree")
                        .param("materialId", "not-exists")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("仓库浏览：读本地检出根，目录先序、文本可读、二进制只标记、路径穿越被拒")
    @SuppressWarnings("unchecked")
    void repoBrowseReadsLocalCheckout() throws Exception {
        String kbId = createKb();
        String repo = "repo-" + UUID.randomUUID().toString().substring(0, 8);
        java.nio.file.Path root = java.nio.file.Paths.get("target/test-kb/material-repo", repo);
        Files.createDirectories(root.resolve("src"));
        Files.write(root.resolve("README.md"), "仓库说明".getBytes(StandardCharsets.UTF_8));
        Files.write(root.resolve("src/Main.java"),
                "class Main {}".getBytes(StandardCharsets.UTF_8));
        Files.write(root.resolve("logo.bin"), new byte[]{1, 0, 2});

        String metadata = "{\"kind\":\"REPO\",\"repo\":\"" + repo
                + "\",\"branch\":\"main\",\"commit\":\"abc1234\"}";
        String materialId = seedRepoMaterial(kbId, repo, metadata);

        mvc.perform(get("/api/kb/v1/material/repo/overview")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.repo").value(repo))
                .andExpect(jsonPath("$.data.branch").value("main"))
                .andExpect(jsonPath("$.data.commit").value("abc1234"))
                .andExpect(jsonPath("$.data.fileCount").value(3))
                .andExpect(jsonPath("$.data.docCount").value(1))
                .andExpect(jsonPath("$.data.codeCount").value(1));

        mvc.perform(get("/api/kb/v1/material/repo/tree")
                        .param("materialId", materialId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].entryType").value("DIR"))
                .andExpect(jsonPath("$.data[0].name").value("src"))
                .andExpect(jsonPath("$.data.length()").value(3));

        mvc.perform(get("/api/kb/v1/material/repo/file")
                        .param("materialId", materialId)
                        .param("path", "src/Main.java")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("class Main {}"))
                .andExpect(jsonPath("$.data.binary").value(false));

        mvc.perform(get("/api/kb/v1/material/repo/file")
                        .param("materialId", materialId)
                        .param("path", "logo.bin")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.binary").value(true));

        mvc.perform(get("/api/kb/v1/material/repo/file")
                        .param("materialId", materialId)
                        .param("path", "../escape.txt")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    private String seedRepoMaterial(String kbId, String repo, String metadata) throws Exception {
        MaterialSyncRequest request = new MaterialSyncRequest();
        request.setKbId(kbId);
        request.setTitle(repo);
        request.setFileName(repo + ".zip");
        request.setSourceType("GIT");
        request.setMetadata(metadata);
        request.setContent(("repo:" + repo).getBytes(StandardCharsets.UTF_8));
        MaterialSyncResult result = materialService.syncUpsert(request,
                new KbCaller(TENANT, ACTOR, ACTOR));
        assertEquals(MaterialSyncResult.CREATED, result.getStatus());
        return result.getMaterialId();
    }

    @Test
    @DisplayName("跨租户隔离：同 kbId 在别的租户下按不存在处理")
    void tenantIsolation() throws Exception {
        String kbId = createKb();
        upload(kbId, "iso-" + UUID.randomUUID().toString().substring(0, 8) + ".md",
                "隔离 " + UUID.randomUUID());

        mvc.perform(post("/api/kb/v1/material/page")
                        .header("X-Tenant-Code", "t-other")
                        .header("X-Actor-Id", "u-other")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kbId\":\"" + kbId + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    private String createKb() throws Exception {
        String code = "mat_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "物料测试库");
        body.put("code", code);
        body.put("type", "FILE");
        MvcResult result = mvc.perform(post("/api/kb/v1/knowledgeBase/add")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        @SuppressWarnings("unchecked")
        Map<String, Object> root = objectMapper.readValue(
                result.getResponse().getContentAsString(), Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) root.get("data");
        return (String) data.get("kbId");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> upload(String kbId, String fileName, String content)
            throws Exception {
        MvcResult result = mvc.perform(multipart("/api/kb/v1/material/upload")
                        .file(new MockMultipartFile("files", fileName, "text/markdown",
                                content.getBytes(StandardCharsets.UTF_8)))
                        .param("kbId", kbId)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, Object> root = objectMapper.readValue(
                result.getResponse().getContentAsString(), Map.class);
        return ((java.util.List<Map<String, Object>>) root.get("data")).get(0);
    }

    private String addCategory(String kbId, String parentId, String name) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kbId", kbId);
        if (parentId != null) {
            body.put("parentId", parentId);
        }
        body.put("name", name);
        MvcResult result = mvc.perform(post("/api/kb/v1/materialCategory/add")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        @SuppressWarnings("unchecked")
        Map<String, Object> root = objectMapper.readValue(
                result.getResponse().getContentAsString(), Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) root.get("data");
        return (String) data.get("categoryId");
    }
}
