package com.zifang.z.kb.protocol;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.protocol.request.CreateSessionRequest;
import com.zifang.z.kb.protocol.request.ImportMarkdownRequest;
import com.zifang.z.kb.protocol.request.SessionChatRequest;
import com.zifang.z.kb.protocol.request.WebhookPayload;
import com.zifang.z.kb.protocol.response.CountResponse;
import com.zifang.z.kb.protocol.response.DataSourceSummary;
import com.zifang.z.kb.protocol.response.ErrorResponse;
import com.zifang.z.kb.protocol.response.IngestItemSummary;
import com.zifang.z.kb.protocol.response.IngestSummary;
import com.zifang.z.kb.protocol.response.ListSourcesResponse;
import com.zifang.z.kb.protocol.response.SourceTypeSummary;
import com.zifang.z.kb.protocol.response.WebhookAck;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 协议层契约测试 —— 钉住每个 DTO 对外的 JSON 键集合。
 *
 * <p><b>这些期望值不是"当前该长什么样"，而是"改造前裸 Map 字面量里放的是哪几个键"</b>。
 * 改造前 z-kb-web 的 controller 用 {@code Map<String,Object>} 手工 put/get，
 * 键名散在各处、没有类型检查；现在搬到 DTO 里，就必须由测试把那份键集合原样继承下来。
 * 少一个键、多一个键、改一个键 —— 任何一种都会让本测试变红。
 */
class ProtocolContractTest {

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * 取序列化后的全部顶层键（有序，便于失败时肉眼比对）。
     * 逐个都取的是**实际存在**的键 —— 期望值用 set(...) 写死，
     * 所以"多出一个键"和"少一个键"都会让断言失败。
     */
    private Set<String> topLevelKeys(Object value) throws Exception {
        Set<String> keys = new TreeSet<>();
        mapper.readTree(mapper.writeValueAsString(value)).fieldNames().forEachRemaining(keys::add);
        return keys;
    }

    // ───────────────────────── 请求侧 ─────────────────────────

    @Test
    @DisplayName("CreateSessionRequest：键集合 = workspace/userId/title")
    void createSessionRequestKeys() throws Exception {
        assertEquals(set("workspace", "userId", "title"), topLevelKeys(new CreateSessionRequest()));
    }

    @Test
    @DisplayName("CreateSessionRequest：缺省 workspace = default（改造前靠 getOrDefault）")
    void createSessionRequestDefault() throws Exception {
        CreateSessionRequest r = mapper.readValue("{}", CreateSessionRequest.class);
        assertEquals("default", r.getWorkspace());
    }

    @Test
    @DisplayName("SessionChatRequest：键集合 = question")
    void sessionChatRequestKeys() throws Exception {
        assertEquals(set("question"), topLevelKeys(new SessionChatRequest()));
    }

    @Test
    @DisplayName("ImportMarkdownRequest：键集合 = workspace/title/content/tags/author")
    void importMarkdownRequestKeys() throws Exception {
        assertEquals(set("workspace", "title", "content", "tags", "author"),
                topLevelKeys(new ImportMarkdownRequest()));
    }

    @Test
    @DisplayName("ImportMarkdownRequest：缺省 workspace = default，tags 不为 null")
    void importMarkdownRequestDefaults() throws Exception {
        ImportMarkdownRequest r = mapper.readValue("{}", ImportMarkdownRequest.class);
        assertEquals("default", r.getWorkspace());
        assertTrue(r.getTags().isEmpty(), "tags 缺省应是空列表，改造前为 null 传给 service");
    }

    @Test
    @DisplayName("WebhookPayload：键集合 = title/content/workspace/metadata")
    void webhookPayloadKeys() throws Exception {
        assertEquals(set("title", "content", "workspace", "metadata"),
                topLevelKeys(new WebhookPayload()));
    }

    @Test
    @DisplayName("WebhookPayload：缺省值与改造前 getOrDefault 逐项一致")
    void webhookPayloadDefaults() throws Exception {
        WebhookPayload p = mapper.readValue("{}", WebhookPayload.class);
        assertEquals("Webhook 文档", p.getTitle());
        assertEquals("", p.getContent());
        assertEquals("default", p.getWorkspace());
        assertTrue(p.getMetadata().isEmpty());
    }

    // ───────────────────────── 响应侧 ─────────────────────────

    @Test
    @DisplayName("ErrorResponse：键集合 = status/code/message")
    void errorResponseKeys() throws Exception {
        assertEquals(set("status", "code", "message"),
                topLevelKeys(new ErrorResponse(400, "boom")));
    }

    @Test
    @DisplayName("ErrorResponse：status 恒为 error")
    void errorResponseStatus() throws Exception {
        assertEquals("error", new ErrorResponse(500, "x").getStatus());
        assertEquals("error", mapper.readTree(
                mapper.writeValueAsString(new ErrorResponse(500, "x"))).get("status").asText());
    }

    @Test
    @DisplayName("CountResponse：键集合 = count（改造前是 singletonMap）")
    void countResponseKeys() throws Exception {
        assertEquals(set("count"), topLevelKeys(new CountResponse(7)));
        assertEquals(7, mapper.readTree(mapper.writeValueAsString(new CountResponse(7)))
                .get("count").asLong());
    }

    @Test
    @DisplayName("ListSourcesResponse：键集合 = sources/supportedTypes")
    void listSourcesResponseKeys() throws Exception {
        ListSourcesResponse r = new ListSourcesResponse();
        r.setSources(new ArrayList<>());
        r.setSupportedTypes(new ArrayList<>());
        assertEquals(set("sources", "supportedTypes"), topLevelKeys(r));
    }

    @Test
    @DisplayName("DataSourceSummary：键集合 = sourceId/type/label/enabled")
    void dataSourceSummaryKeys() throws Exception {
        assertEquals(set("sourceId", "type", "label", "enabled"),
                topLevelKeys(new DataSourceSummary()));
    }

    @Test
    @DisplayName("SourceTypeSummary：键集合 = name/label")
    void sourceTypeSummaryKeys() throws Exception {
        assertEquals(set("name", "label"), topLevelKeys(new SourceTypeSummary("WEB", "网页")));
    }

    @Test
    @DisplayName("WebhookAck：键集合 = accepted/pending")
    void webhookAckKeys() throws Exception {
        assertEquals(set("accepted", "pending"), topLevelKeys(new WebhookAck(true, 3)));
    }

    @Test
    @DisplayName("IngestSummary：键集合 = 8 个顶层计数/明细键")
    void ingestSummaryKeys() throws Exception {
        assertEquals(set("count", "success", "failed", "skipped",
                        "totalChunks", "totalEntities", "totalRelations", "items"),
                topLevelKeys(new IngestSummary()));
    }

    @Test
    @DisplayName("IngestItemSummary：键集合 = 7 个固定键 + error（error 可缺省）")
    void ingestItemSummaryKeys() throws Exception {
        assertEquals(set("requestId", "documentId", "status", "elapsedMillis",
                        "chunkCount", "entityCount", "relationCount"),
                topLevelKeys(new IngestItemSummary()));
    }

    // ───────────── 本次重构最容易悄悄改掉线格式的那一条 ─────────────

    @Test
    @DisplayName("成功项不含 error 键 —— 改造前是 if(err!=null) put，null 时整个键不出现")
    void successItemHasNoErrorKey() throws Exception {
        IngestItemSummary item = new IngestItemSummary();
        item.setRequestId("r-1");
        item.setStatus("SUCCESS");
        // 模拟 controller 里的旧行为：成功项 error 为 null
        assertEquals(null, item.getError());

        String json = mapper.writeValueAsString(item);
        assertFalse(mapper.readTree(json).has("error"),
                "成功项的 JSON 里不得凭空多出 \"error\":null —— 那会给每个成功项加一个键，属契约变更");

        // 失败项则必须带 error
        item.setStatus("FAILED");
        item.setError("拉取超时");
        assertTrue(mapper.readTree(mapper.writeValueAsString(item)).has("error"));
    }

    @Test
    @DisplayName("IngestSummary.items 为空时输出空数组而非 null")
    void ingestSummaryEmptyItems() throws Exception {
        IngestSummary s = new IngestSummary();
        s.setCount(0);
        assertTrue(mapper.readTree(mapper.writeValueAsString(s)).get("items").isArray());
    }

    private static Set<String> set(String... items) {
        return new TreeSet<>(Arrays.asList(items));
    }
}
