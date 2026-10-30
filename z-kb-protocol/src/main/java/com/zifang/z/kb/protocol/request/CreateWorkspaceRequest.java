package com.zifang.z.kb.protocol.request;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 创建工作台请求 —— {@code POST /api/kb/workspaces}。
 */
@Schema(description = "创建工作台请求")
public class CreateWorkspaceRequest {

    @Schema(description = "工作台名", example = "product")
    private String name;

    @Schema(description = "工作台描述", example = "产品线知识库")
    private String description;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
