package com.zifang.z.kb.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 实体 — 知识图谱的节点。
 *
 * <p>设计要点：
 * <ul>
 *   <li>{@code canonicalName} 是规范化主键（用于去重和合并）</li>
 *   <li>{@code aliases} 是别名集合（同一实体的不同写法）</li>
 *   <li>{@code type} 是实体类型（PERSON / ORG / TECH / CONCEPT 等）</li>
 *   <li>{@code sourceChunkIds} 记录该实体从哪些块抽取出来，用于引用回溯</li>
 *   <li>{@code importance} 由 TF-IDF / PageRank 等算法计算，用于排序</li>
 * </ul>
 */
public class Entity {

    /** 实体唯一 ID */
    private String id;

    /** 规范化主键（如 "InfluxDB"） */
    private String canonicalName;

    /** 显示名（如 "InfluxDB 时序数据库"） */
    private String displayName;

    /** 实体类型 */
    private EntityType type = EntityType.CONCEPT;

    /** 别名集合 */
    private List<String> aliases = new ArrayList<>();

    /** 描述 / 简介（来自上下文首句或第一段） */
    private String description;

    /** 所属工作台 */
    private String workspace = "default";

    /** 出现频次（在所有文档中提及次数） */
    private int frequency;

    /** 重要性评分（0~1，TF-IDF + 度数加权） */
    private double importance;

    /** 该实体出现的源块 ID 列表（用于引用回溯） */
    private List<String> sourceChunkIds = new ArrayList<>();

    /** 实体来源文档 ID */
    private List<String> sourceDocumentIds = new ArrayList<>();

    /** 扩展属性 */
    private Map<String, Object> properties = new LinkedHashMap<>();

    /** 创建时间 */
    private Instant createdAt = Instant.now();

    /** 最后更新时间 */
    private Instant updatedAt = Instant.now();

    public Entity() {
        this.id = UUID.randomUUID().toString();
    }

    public Entity(String canonicalName, EntityType type) {
        this();
        this.canonicalName = canonicalName;
        this.type = type;
        this.displayName = canonicalName;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCanonicalName() { return canonicalName; }
    public void setCanonicalName(String canonicalName) { this.canonicalName = canonicalName; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public EntityType getType() { return type; }
    public void setType(EntityType type) { this.type = type; }
    public List<String> getAliases() { return aliases; }
    public void setAliases(List<String> aliases) { this.aliases = aliases; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public int getFrequency() { return frequency; }
    public void setFrequency(int frequency) { this.frequency = frequency; }
    public double getImportance() { return importance; }
    public void setImportance(double importance) { this.importance = importance; }
    public List<String> getSourceChunkIds() { return sourceChunkIds; }
    public void setSourceChunkIds(List<String> sourceChunkIds) { this.sourceChunkIds = sourceChunkIds; }
    public List<String> getSourceDocumentIds() { return sourceDocumentIds; }
    public void setSourceDocumentIds(List<String> sourceDocumentIds) { this.sourceDocumentIds = sourceDocumentIds; }
    public Map<String, Object> getProperties() { return properties; }
    public void setProperties(Map<String, Object> properties) { this.properties = properties; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Builder {
        private final Entity e = new Entity();
        public Builder id(String v) { e.id = v; return this; }
        public Builder canonicalName(String v) { e.canonicalName = v; return this; }
        public Builder displayName(String v) { e.displayName = v; return this; }
        public Builder type(EntityType v) { e.type = v; return this; }
        public Builder aliases(List<String> v) { e.aliases = v; return this; }
        public Builder description(String v) { e.description = v; return this; }
        public Builder workspace(String v) { e.workspace = v; return this; }
        public Builder frequency(int v) { e.frequency = v; return this; }
        public Builder importance(double v) { e.importance = v; return this; }
        public Builder sourceChunkIds(List<String> v) { e.sourceChunkIds = v; return this; }
        public Builder sourceDocumentIds(List<String> v) { e.sourceDocumentIds = v; return this; }
        public Builder properties(Map<String, Object> v) { e.properties = v; return this; }
        public Entity build() { return e; }
    }
}
