package com.zifang.z.kb.protocol.request;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 创建会话请求 —— {@code POST /api/kb/chat/sessions}。
 */
@Schema(description = "创建会话请求")
public class CreateSessionRequest {

    @Schema(description = "工作台名", example = "default")
    private String workspace = "default";

    @Schema(description = "用户标识；不传则视为匿名会话")
    private String userId;

    @Schema(description = "会话标题")
    private String title;

    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
