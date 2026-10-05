package com.zifang.z.kb.web;

import com.zifang.z.kb.api.ChatResponse;
import com.zifang.z.kb.api.ChatService;
import com.zifang.z.kb.api.ImportResult;
import com.zifang.z.kb.api.Workspace;
import com.zifang.z.kb.api.ChatSession;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.api.IngestResult;
import com.zifang.z.kb.ingest.pipeline.DataSourceRegistry;
import com.zifang.z.kb.ingest.pipeline.IngestPipeline;
import com.zifang.z.kb.ingest.source.WebhookSource;
import com.zifang.z.kb.web.controller.ChatController;
import com.zifang.z.kb.web.controller.DocumentController;
import com.zifang.z.kb.web.controller.IngestController;
import com.zifang.z.kb.web.controller.WorkspaceController;
import com.zifang.z.kb.web.exception.WebExceptionHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REST 契约测试 —— 证明把裸 {@code Map} 换成 DTO 之后，线上的 JSON 没变。
 *
 * <p>每个用例都同时钉两件事：
 * <ol>
 *   <li><b>响应体</b>的键集合与改前一致（改前是 controller 里手写的 {@code m.put(...)}）；</li>
 *   <li><b>入参</b>确实按契约落到了 service 方法的对应形参上
 *       —— 只断言响应形状不足以证明 DTO 映射正确，那种测试改了字段接线也能绿。</li>
 * </ol>
 *
 * <p>用 {@code standaloneSetup} 而非 {@code @WebMvcTest}：不加载 Spring 容器，
 * 跑得快，且能精确控制被测的 controller。
 */
class RestContractTest {

    private final ObjectMapper mapper = new ObjectMapper();

    /** standaloneSetup：不加载 Spring 容器，跑得快且被测面精确。 */
    private MockMvc mvc(Object controller) {
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new WebExceptionHandler())
                .build();
    }

    private static <T> T inject(Object target, String field, T value) {
        ReflectionTestUtils.setField(target, field, value);
        return value;
    }

    /** ImportResult 是纯 POJO（无工厂方法），按 setter 造。 */
    private static ImportResult importResult(String docId, int chunks) {
        ImportResult r = new ImportResult();
        r.setDocumentId(docId);
        r.setChunkCount(chunks);
        return r;
    }

    // ─────────────── 文档管理 ───────────────

    @Test
    @DisplayName("POST /documents/markdown：响应键不变，且 tags/author 落到 service 形参")
    void importMarkdownKeepsWireFormat() throws Exception {
        KnowledgeBaseService svc = mock(KnowledgeBaseService.class);
        when(svc.importMarkdown(anyString(), any(), any(), any(), any()))
                .thenReturn(importResult("d-1", 3));
        DocumentController c = new DocumentController();
        inject(c, "kbService", svc);
        MockMvc mvc = mvc(c);

        mvc.perform(post("/api/kb/documents/markdown")
                        .contentType("application/json")
                        .content("{\"title\":\"手册\",\"content\":\"# x\",\"tags\":[\"a\",\"b\"],\"author\":\"yuku\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value("d-1"));

        ArgumentCaptor<List<String>> tags = ArgumentCaptor.forClass(List.class);
        verify(svc).importMarkdown(eq("default"), eq("手册"), eq("# x"), tags.capture(), eq("yuku"));
        assertEquals(java.util.Arrays.asList("a", "b"), tags.getValue());
    }

    @Test
    @DisplayName("POST /documents/markdown：请求体为空时 workspace 仍回落 default")
    void importMarkdownDefaultsToDefaultWorkspace() throws Exception {
        KnowledgeBaseService svc = mock(KnowledgeBaseService.class);
        when(svc.importMarkdown(anyString(), any(), any(), any(), any()))
                .thenReturn(importResult("d-2", 1));
        DocumentController c = new DocumentController();
        inject(c, "kbService", svc);

        mvc(c).perform(post("/api/kb/documents/markdown")
                        .contentType("application/json")
                        .content("{\"content\":\"x\"}"))
                .andExpect(status().isOk());

        verify(svc).importMarkdown(eq("default"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("GET /documents/{ws}/count：响应仍是单个 count 键（改前是 singletonMap）")
    void countKeepsSingleKey() throws Exception {
        KnowledgeBaseService svc = mock(KnowledgeBaseService.class);
        when(svc.countDocuments("default")).thenReturn(42L);
        DocumentController c = new DocumentController();
        inject(c, "kbService", svc);

        byte[] body = mvc(c).perform(get("/api/kb/documents/default/count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(42))
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(1, n.size(), "count 响应必须仍只有一个键，实得：" + n.fieldNames().next());
    }

    // ─────────────── 工作台 ───────────────

    @Test
    @DisplayName("POST /workspaces：name/description 落到 service 形参")
    void createWorkspaceKeepsWireFormat() throws Exception {
        KnowledgeBaseService svc = mock(KnowledgeBaseService.class);
        when(svc.createWorkspace(anyString(), any()))
                .thenReturn(new Workspace("product"));
        WorkspaceController c = new WorkspaceController();
        inject(c, "kbService", svc);

        mvc(c).perform(post("/api/kb/workspaces")
                        .contentType("application/json")
                        .content("{\"name\":\"product\",\"description\":\"产品线知识库\"}"))
                .andExpect(status().isOk());

        verify(svc).createWorkspace("product", "产品线知识库");
    }

    // ─────────────── 问答 ───────────────

    @Test
    @DisplayName("POST /chat/sessions：缺省 workspace = default，userId/title 直传")
    void createSessionKeepsWireFormat() throws Exception {
        ChatService svc = mock(ChatService.class);
        when(svc.createSession(anyString(), any(), any())).thenReturn(new ChatSession());
        ChatController c = new ChatController();
        inject(c, "chatService", svc);

        mvc(c).perform(post("/api/kb/chat/sessions")
                        .contentType("application/json")
                        .content("{\"userId\":\"u1\",\"title\":\"排查\"}"))
                .andExpect(status().isOk());

        verify(svc).createSession("default", "u1", "排查");
    }

    @Test
    @DisplayName("POST /chat/sessions/{id}/chat：question 落到 chatInSession 第二形参")
    void chatInSessionPassesQuestion() throws Exception {
        ChatService svc = mock(ChatService.class);
        when(svc.chatInSession(anyString(), any()))
                .thenReturn(new ChatResponse());
        ChatController c = new ChatController();
        inject(c, "chatService", svc);

        mvc(c).perform(post("/api/kb/chat/sessions/s-1/chat")
                        .contentType("application/json")
                        .content("{\"question\":\"怎么部署？\"}"))
                .andExpect(status().isOk());

        verify(svc).chatInSession("s-1", "怎么部署？");
    }

    // ─────────────── 数据接入 ───────────────

    @Test
    @DisplayName("GET /ingest/sources：顶层仍是 sources/supportedTypes，元素键仍是那 4 个")
    void listSourcesKeepsWireFormat() throws Exception {
        DataSourceRegistry registry = mock(DataSourceRegistry.class);
        when(registry.list()).thenReturn(Collections.emptyList());
        IngestController c = new IngestController();
        inject(c, "registry", registry);
        inject(c, "pipeline", mock(IngestPipeline.class));
        inject(c, "webhookSource", mock(WebhookSource.class));

        byte[] body = mvc(c).perform(get("/api/kb/ingest/sources"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(2, n.size(), "顶层应恰为 sources/supportedTypes 两键");
        assertTrue(n.has("sources") && n.has("supportedTypes"));
        assertTrue(n.get("supportedTypes").isArray());
        // supportedTypes 元素键 = name/label
        JsonNode first = n.get("supportedTypes").get(0);
        assertEquals(2, first.size());
        assertTrue(first.has("name") && first.has("label"));
    }

    @Test
    @DisplayName("GET /ingest/sources：数据源元素含 sourceId/type/label/enabled")
    void listSourcesItemKeys() throws Exception {
        DataSourceRegistry registry = mock(DataSourceRegistry.class);
        com.zifang.z.kb.ingest.api.DataSource src =
                mock(com.zifang.z.kb.ingest.api.DataSource.class);
        when(src.getSourceId()).thenReturn("markdown-src");
        when(src.getType()).thenReturn(DataSourceType.MARKDOWN);
        when(src.isEnabled()).thenReturn(true);
        when(registry.list()).thenReturn(Collections.singletonList(src));

        IngestController c = new IngestController();
        inject(c, "registry", registry);
        inject(c, "pipeline", mock(IngestPipeline.class));
        inject(c, "webhookSource", mock(WebhookSource.class));

        byte[] body = mvc(c).perform(get("/api/kb/ingest/sources"))
                .andReturn().getResponse().getContentAsByteArray();
        JsonNode item = mapper.readTree(body).get("sources").get(0);
        assertEquals(4, item.size(), "数据源元素应恰为 4 键");
        assertEquals("markdown-src", item.get("sourceId").asText());
        assertEquals("MARKDOWN", item.get("type").asText(), "type 存枚举名，改前就是 name()");
        assertTrue(item.has("label") && item.has("enabled"));
    }

    @Test
    @DisplayName("POST /ingest/run：汇总响应 8 个顶层键，成功项不含 error")
    void ingestRunKeepsSummaryShape() throws Exception {
        IngestPipeline pipeline = mock(IngestPipeline.class);
        IngestResult ok = IngestResult.success("r-1", "d-1", 3, 2, 1, 12L);
        IngestResult bad = IngestResult.failed("r-2", "拉取超时");
        when(pipeline.ingest(eq("markdown-src"), any())).thenReturn(java.util.Arrays.asList(ok, bad));

        IngestController c = new IngestController();
        inject(c, "pipeline", pipeline);
        inject(c, "registry", mock(DataSourceRegistry.class));
        inject(c, "webhookSource", mock(WebhookSource.class));

        byte[] body = mvc(c).perform(post("/api/kb/ingest/run").param("sourceId", "markdown-src")
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(8, n.size(), "汇总应恰为 8 个顶层键，实得：" + n);
        assertEquals(2, n.get("count").asInt());
        assertEquals(1, n.get("success").asLong());
        assertEquals(1, n.get("failed").asLong());
        assertEquals(3, n.get("totalChunks").asInt());
        assertEquals(2, n.get("totalEntities").asInt());
        assertEquals(1, n.get("totalRelations").asInt());

        assertFalse(n.get("items").get(0).has("error"), "成功项不得出现 error 键");
        assertTrue(n.get("items").get(1).has("error"), "失败项必须带 error");
    }

    @Test
    @DisplayName("POST /ingest/run：config 缺省时传空 Map，不传 null")
    void ingestRunDefaultsConfig() throws Exception {
        IngestPipeline pipeline = mock(IngestPipeline.class);
        when(pipeline.ingest(eq("markdown-src"), any())).thenReturn(Collections.emptyList());
        IngestController c = new IngestController();
        inject(c, "pipeline", pipeline);
        inject(c, "registry", mock(DataSourceRegistry.class));
        inject(c, "webhookSource", mock(WebhookSource.class));

        mvc(c).perform(post("/api/kb/ingest/run").param("sourceId", "markdown-src"))
                .andExpect(status().isOk());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Map<String, Object>> capt =
                ArgumentCaptor.forClass(java.util.Map.class);
        verify(pipeline).ingest(eq("markdown-src"), capt.capture());
        assertTrue(capt.getValue() != null && capt.getValue().isEmpty());
    }

    @Test
    @DisplayName("POST /ingest/webhook：回执键仍是 accepted/pending，metadata 并入 workspace")
    void webhookAckKeepsWireFormat() throws Exception {
        WebhookSource ws = mock(WebhookSource.class);
        when(ws.accept(any(), any(), anyString(), anyString(), any())).thenReturn(true);
        when(ws.pending()).thenReturn(2);
        IngestController c = new IngestController();
        inject(c, "webhookSource", ws);
        inject(c, "pipeline", mock(IngestPipeline.class));
        inject(c, "registry", mock(DataSourceRegistry.class));

        byte[] body = mvc(c).perform(post("/api/kb/ingest/webhook")
                        .contentType("application/json")
                        .content("{\"content\":\"# hi\",\"metadata\":{\"src\":\"gitlab\"}}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(2, n.size(), "回执应恰为 accepted/pending 两键");
        assertTrue(n.get("accepted").asBoolean());
        assertEquals(2, n.get("pending").asInt());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Map<String, Object>> meta =
                ArgumentCaptor.forClass(java.util.Map.class);
        verify(ws).accept(any(), any(), eq("Webhook 文档"), eq("# hi"), meta.capture());
        assertEquals("default", meta.getValue().get("workspace"), "workspace 应被并入 metadata");
        assertEquals("gitlab", meta.getValue().get("src"), "原有 metadata 键不能被覆盖丢失");
    }

    @Test
    @DisplayName("POST /ingest/webhook：校验失败抛 KBException → 400 + 错误信封三键")
    void webhookFailureReturnsErrorEnvelope() throws Exception {
        WebhookSource ws = mock(WebhookSource.class);
        when(ws.accept(any(), any(), anyString(), anyString(), any())).thenReturn(false);
        IngestController c = new IngestController();
        inject(c, "webhookSource", ws);
        inject(c, "pipeline", mock(IngestPipeline.class));
        inject(c, "registry", mock(DataSourceRegistry.class));

        byte[] body = mvc(c).perform(post("/api/kb/ingest/webhook")
                        .contentType("application/json").content("{\"content\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(3, n.size(), "错误信封应恰为 status/code/message 三键");
        assertEquals("error", n.get("status").asText());
        assertEquals(400, n.get("code").asInt());
        assertTrue(n.get("message").asText().contains("webhook"));
    }

    @Test
    @DisplayName("POST /ingest/submit：空列表抛 KBException → 400")
    void submitEmptyListRejected() throws Exception {
        IngestController c = new IngestController();
        inject(c, "pipeline", mock(IngestPipeline.class));
        inject(c, "registry", mock(DataSourceRegistry.class));
        inject(c, "webhookSource", mock(WebhookSource.class));

        mvc(c).perform(post("/api/kb/ingest/submit")
                        .contentType("application/json").content("[]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("未处理异常 → 500 + 错误信封三键（WebExceptionHandler 已改用 ErrorResponse）")
    void unhandledExceptionReturnsErrorEnvelope() throws Exception {
        KnowledgeBaseService svc = mock(KnowledgeBaseService.class);
        when(svc.listWorkspaces()).thenThrow(new IllegalStateException("db down"));
        WorkspaceController c = new WorkspaceController();
        inject(c, "kbService", svc);

        byte[] body = mvc(c).perform(get("/api/kb/workspaces"))
                .andExpect(status().isInternalServerError())
                .andReturn().getResponse().getContentAsByteArray();

        JsonNode n = mapper.readTree(body);
        assertEquals(3, n.size());
        assertEquals("error", n.get("status").asText());
        assertEquals(500, n.get("code").asInt());
    }
}
