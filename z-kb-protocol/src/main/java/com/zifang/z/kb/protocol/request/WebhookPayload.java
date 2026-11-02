package com.zifang.z.kb.protocol.request;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Webhook 推送体 —— {@code POST /api/kb/ingest/webhook}。
 *
 * <p>请求头 {@code X-Signature} / {@code X-Secret} 参与校验，不在请求体里。
 */
@Schema(description = "Webhook 推送体")
public class WebhookPayload {

    @Schema(description = "文档标题", example = "Webhook 文档")
    private String title = "Webhook 文档";

    @Schema(description = "Markdown 正文")
    private String content = "";

    @Schema(description = "工作台名", example = "default")
    private String workspace = "default";

    @Schema(description = "附加元数据；处理时会并入 workspace")
    private Map<String, Object> metadata = new LinkedHashMap<>();

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}
