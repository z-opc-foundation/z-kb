package com.zifang.z.kb.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 文档 — 知识库的基本单元，对应一个 Markdown 文件或一篇导入的文章。
 *
 * <p>设计原则：
 * <ul>
 *   <li>字段以 DO 后缀风格命名，但作为跨模块的契约数据模型，使用 POJO 不可变风格 + Builder</li>
 *   <li>正文 {@code content} 是原始 Markdown，{@link #frontmatter} 是 YAML 元数据</li>
 *   <li>{@code tags} 是从正文/前置元数据抽取的标签集合，用于分类与全文检索过滤</li>
 *   <li>{@code workspace} 用于多租户/多知识库隔离</li>
 *   <li>{@code status} 用于异步处理状态（CREATED / PARSING / INDEXED / FAILED）</li>
 * </ul>
 */
public class Document {

    /** 文档唯一 ID（UUID v4） */
    private String id;

    /** 文档标题（来自 Markdown 一级标题或文件名） */
    private String title;

    /** 原始 Markdown 内容 */
    private String content;

    /** Markdown 正文（去除 frontmatter 之后） */
    private String body;

    /** frontmatter 解析后的 YAML 元数据（yuque/obsidian 兼容） */
    private Map<String, Object> frontmatter = new LinkedHashMap<>();

    /** 标签集合 */
    private List<String> tags = new ArrayList<>();

    /** 文档所属工作台（用于多知识库隔离） */
    private String workspace = "default";

    /** 文档作者 */
    private String author;

    /** 文档源 URL（如 yuque 链接） */
    private String sourceUrl;

    /** 文档路径（文件路径或 wikilink 名称） */
    private String path;

    /** 文档分类 */
    private String category;

    /** 文档状态 */
    private DocumentStatus status = DocumentStatus.CREATED;

    /** 文档字数（解析时计算） */
    private long wordCount;

    /** 文档块数（分块后） */
    private int chunkCount;

    /** 创建时间（UTC） */
    private Instant createdAt = Instant.now();

    /** 最后更新时间（UTC） */
    private Instant updatedAt = Instant.now();

    public Document() {
        this.id = UUID.randomUUID().toString();
    }

    public static Builder builder() {
        return new Builder();
    }

    /** 拷贝构造（用于版本快照） */
    public Document copy() {
        Document d = new Document();
        d.id = this.id;
        d.title = this.title;
        d.content = this.content;
        d.body = this.body;
        d.frontmatter = new LinkedHashMap<>(this.frontmatter);
        d.tags = new ArrayList<>(this.tags);
        d.workspace = this.workspace;
        d.author = this.author;
        d.sourceUrl = this.sourceUrl;
        d.path = this.path;
        d.category = this.category;
        d.status = this.status;
        d.wordCount = this.wordCount;
        d.chunkCount = this.chunkCount;
        d.createdAt = this.createdAt;
        d.updatedAt = Instant.now();
        return d;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Map<String, Object> getFrontmatter() { return frontmatter; }
    public void setFrontmatter(Map<String, Object> frontmatter) { this.frontmatter = frontmatter; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public long getWordCount() { return wordCount; }
    public void setWordCount(long wordCount) { this.wordCount = wordCount; }
    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Builder {
        private final Document d = new Document();
        public Builder id(String v) { d.id = v; return this; }
        public Builder title(String v) { d.title = v; return this; }
        public Builder content(String v) { d.content = v; return this; }
        public Builder body(String v) { d.body = v; return this; }
        public Builder frontmatter(Map<String, Object> v) { d.frontmatter = v; return this; }
        public Builder tags(List<String> v) { d.tags = v; return this; }
        public Builder workspace(String v) { d.workspace = v; return this; }
        public Builder author(String v) { d.author = v; return this; }
        public Builder sourceUrl(String v) { d.sourceUrl = v; return this; }
        public Builder path(String v) { d.path = v; return this; }
        public Builder category(String v) { d.category = v; return this; }
        public Builder status(DocumentStatus v) { d.status = v; return this; }
        public Builder wordCount(long v) { d.wordCount = v; return this; }
        public Builder chunkCount(int v) { d.chunkCount = v; return this; }
        public Builder createdAt(Instant v) { d.createdAt = v; return this; }
        public Builder updatedAt(Instant v) { d.updatedAt = v; return this; }
        public Document build() { return d; }
    }
}
