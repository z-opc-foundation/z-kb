package com.zifang.z.kb.api;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 文档块 — Document 经过智能分块后的最小检索单元。
 *
 * <p>设计要点：
 * <ul>
 *   <li>每块包含原文（{@code content}）和从该块所属上下文继承的"上下文标题"（{@code contextTitle}）</li>
 *   <li>{@code embedding} 在 Index 阶段生成；持久化时一般存到向量库，本字段为可选缓存</li>
 *   <li>{@code keywords} 是从该块提取的关键词（TF-IDF），用于全文检索打分与高亮</li>
 *   <li>{@code meta} 携带位置信息（startOffset/endOffset/headingPath）用于引用回溯</li>
 * </ul>
 */
public class Chunk {

    /** 块唯一 ID（UUID v4） */
    private String id;

    /** 所属文档 ID */
    private String documentId;

    /** 所属工作台 */
    private String workspace = "default";

    /** 块在文档中的顺序索引（从 0 开始） */
    private int ordinal;

    /** 块正文（不含 frontmatter） */
    private String content;

    /** 上下文标题（如 "H1 > H2 > H3" 路径，用于 RAG 引用展示） */
    private String contextTitle;

    /** 块中标题路径（如 ["InfluxDB 实战指南", "一、架构", "1.1 整体架构"]） */
    private List<String> headingPath;

    /** 块长度（字符数） */
    private int length;

    /** 估算 token 数（中英文混合，1 token ≈ 1.5 字符） */
    private int tokenEstimate;

    /** 关键词列表（TF-IDF Top-K） */
    private List<String> keywords;

    /** 该块中出现的实体名（用于图谱关联） */
    private List<String> entityNames;

    /** 块中包含的 wikilink 目标（如 "[[PostgreSQL]]" → ["PostgreSQL"]） */
    private List<String> wikilinkTargets;

    /** 位置信息 + 扩展元数据 */
    private Map<String, Object> meta = new LinkedHashMap<>();

    /** Embedding 向量（持久化时一般存到向量库，本字段为可选缓存） */
    private transient float[] embedding;

    /** 创建时间 */
    private Instant createdAt = Instant.now();

    public Chunk() {
        this.id = UUID.randomUUID().toString();
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public int getOrdinal() { return ordinal; }
    public void setOrdinal(int ordinal) { this.ordinal = ordinal; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getContextTitle() { return contextTitle; }
    public void setContextTitle(String contextTitle) { this.contextTitle = contextTitle; }
    public List<String> getHeadingPath() { return headingPath; }
    public void setHeadingPath(List<String> headingPath) { this.headingPath = headingPath; }
    public int getLength() { return length; }
    public void setLength(int length) { this.length = length; }
    public int getTokenEstimate() { return tokenEstimate; }
    public void setTokenEstimate(int tokenEstimate) { this.tokenEstimate = tokenEstimate; }
    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords; }
    public List<String> getEntityNames() { return entityNames; }
    public void setEntityNames(List<String> entityNames) { this.entityNames = entityNames; }
    public List<String> getWikilinkTargets() { return wikilinkTargets; }
    public void setWikilinkTargets(List<String> wikilinkTargets) { this.wikilinkTargets = wikilinkTargets; }
    public Map<String, Object> getMeta() { return meta; }
    public void setMeta(Map<String, Object> meta) { this.meta = meta; }
    public float[] getEmbedding() { return embedding; }
    public void setEmbedding(float[] embedding) { this.embedding = embedding; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static class Builder {
        private final Chunk c = new Chunk();
        public Builder id(String v) { c.id = v; return this; }
        public Builder documentId(String v) { c.documentId = v; return this; }
        public Builder workspace(String v) { c.workspace = v; return this; }
        public Builder ordinal(int v) { c.ordinal = v; return this; }
        public Builder content(String v) { c.content = v; return this; }
        public Builder contextTitle(String v) { c.contextTitle = v; return this; }
        public Builder headingPath(List<String> v) { c.headingPath = v; return this; }
        public Builder length(int v) { c.length = v; return this; }
        public Builder tokenEstimate(int v) { c.tokenEstimate = v; return this; }
        public Builder keywords(List<String> v) { c.keywords = v; return this; }
        public Builder entityNames(List<String> v) { c.entityNames = v; return this; }
        public Builder wikilinkTargets(List<String> v) { c.wikilinkTargets = v; return this; }
        public Builder meta(Map<String, Object> v) { c.meta = v; return this; }
        public Builder embedding(float[] v) { c.embedding = v; return this; }
        public Builder createdAt(Instant v) { c.createdAt = v; return this; }
        public Chunk build() { return c; }
    }
}
