package com.zifang.z.kb.protocol.request;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Webhook 推送体 —— {@code POST /api/kb/ingest/webhook}。
 *
 * <p>请求头 {@code X-Signature} / {@code X-Secret} 参与校验，不在请求体里。
 */
@ApiModel(description = "Webhook 推送体")
public class WebhookPayload {

    @ApiModelProperty(value = "文档标题", example = "Webhook 文档")
    private String title = "Webhook 文档";

    @ApiModelProperty(value = "Markdown 正文")
    private String content = "";

    @ApiModelProperty(value = "工作台名", example = "default")
    private String workspace = "default";

    @ApiModelProperty(value = "附加元数据；处理时会并入 workspace")
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
