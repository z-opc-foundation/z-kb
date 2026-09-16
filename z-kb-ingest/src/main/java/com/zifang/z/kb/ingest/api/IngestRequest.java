package com.zifang.z.kb.ingest.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 接入请求 — 一份待处理的原始文档。
 *
 * <p>来源可以是：语雀导出、URL 抓取、Notion 同步、本地 Markdown 文件、Confluence 页面等。
 * 进入管道后会被标准化为 Markdown，再交给知识库服务索引。
 */
public class IngestRequest {

    /** 唯一 ID（幂等键：相同 ID 不会重复入库） */
    private String id = UUID.randomUUID().toString();

    /** 数据源类型 */
    private DataSourceType sourceType = DataSourceType.MARKDOWN;

    /** 数据源 ID（如语雀 namespace、Git 仓库 URL、Notion page id 等） */
    private String sourceId;

    /** 文档原始内容（Markdown / HTML / 纯文本） */
    private String content;

    /** 内容类型 */
    private String contentType = "text/markdown";

    /** 目标工作台 */
    private String workspace = "default";

    /** 文档标题（未指定则从正文推断） */
    private String title;

    /** 作者 */
    private String author;

    /** 标签 */
    private List<String> tags = new ArrayList<>();

    /** 原始 URL */
    private String sourceUrl;

    /** 文档路径 */
    private String path;

    /** 分类 */
    private String category;

    /** 额外元数据（用于回写源系统） */
    private Map<String, Object> metadata = new LinkedHashMap<>();

    /** 创建时间 */
    private Instant createdAt = Instant.now();

    public IngestRequest() {}

    public static Builder builder() { return new Builder(); }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public DataSourceType getSourceType() { return sourceType; }
    public void setSourceType(DataSourceType sourceType) { this.sourceType = sourceType; }
    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static class Builder {
        private final IngestRequest r = new IngestRequest();
        public Builder id(String v) { r.id = v; return this; }
        public Builder sourceType(DataSourceType v) { r.sourceType = v; return this; }
        public Builder sourceId(String v) { r.sourceId = v; return this; }
        public Builder content(String v) { r.content = v; return this; }
        public Builder contentType(String v) { r.contentType = v; return this; }
        public Builder workspace(String v) { r.workspace = v; return this; }
        public Builder title(String v) { r.title = v; return this; }
        public Builder author(String v) { r.author = v; return this; }
        public Builder tags(List<String> v) { r.tags = v; return this; }
        public Builder sourceUrl(String v) { r.sourceUrl = v; return this; }
        public Builder path(String v) { r.path = v; return this; }
        public Builder category(String v) { r.category = v; return this; }
        public Builder metadata(Map<String, Object> v) { r.metadata = v; return this; }
        public Builder createdAt(Instant v) { r.createdAt = v; return this; }
        public IngestRequest build() { return r; }
    }
}