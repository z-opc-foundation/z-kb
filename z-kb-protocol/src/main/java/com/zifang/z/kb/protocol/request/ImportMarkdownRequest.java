package com.zifang.z.kb.protocol.request;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.ArrayList;
import java.util.List;

/**
 * Markdown 导入请求 —— {@code POST /api/kb/documents/markdown}。
 */
@Schema(description = "Markdown 文档导入请求")
public class ImportMarkdownRequest {

    @Schema(description = "工作台名", example = "default")
    private String workspace = "default";

    @Schema(description = "文档标题", example = "部署手册")
    private String title;

    @Schema(description = "Markdown 正文")
    private String content;

    @Schema(description = "标签")
    private List<String> tags = new ArrayList<>();

    @Schema(description = "作者")
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
