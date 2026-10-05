package com.zifang.z.kb.protocol.request;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Markdown 导入请求 —— {@code POST /api/kb/documents/markdown}。
 */
@ApiModel(description = "Markdown 文档导入请求")
public class ImportMarkdownRequest {

    @ApiModelProperty(value = "工作台名", example = "default")
    private String workspace = "default";

    @ApiModelProperty(value = "文档标题", example = "部署手册")
    private String title;

    @ApiModelProperty(value = "Markdown 正文")
    private String content;

    @ApiModelProperty(value = "标签")
    private List<String> tags = new ArrayList<>();

    @ApiModelProperty(value = "作者")
    private String author;

    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
}
