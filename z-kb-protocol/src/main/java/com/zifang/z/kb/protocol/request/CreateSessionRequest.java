package com.zifang.z.kb.protocol.request;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 创建会话请求 —— {@code POST /api/kb/chat/sessions}。
 */
@ApiModel(description = "创建会话请求")
public class CreateSessionRequest {

    @ApiModelProperty(value = "工作台名", example = "default")
    private String workspace = "default";

    @ApiModelProperty(value = "用户标识；不传则视为匿名会话")
    private String userId;

    @ApiModelProperty(value = "会话标题")
    private String title;

    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
