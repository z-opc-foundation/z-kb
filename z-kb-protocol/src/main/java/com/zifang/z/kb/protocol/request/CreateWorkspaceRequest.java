package com.zifang.z.kb.protocol.request;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 创建工作台请求 —— {@code POST /api/kb/workspaces}。
 */
@ApiModel(description = "创建工作台请求")
public class CreateWorkspaceRequest {

    @ApiModelProperty(value = "工作台名", example = "product")
    private String name;

    @ApiModelProperty(value = "工作台描述", example = "产品线知识库")
    private String description;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
