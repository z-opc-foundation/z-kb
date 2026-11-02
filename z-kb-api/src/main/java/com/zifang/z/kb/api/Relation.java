package com.zifang.z.kb.api;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 关系 — 知识图谱的边，连接两个实体。
 *
 * <p>设计要点：
 * <ul>
 *   <li>{@code type} 是关系类型（如 "BELONGS_TO" / "USES" / "PART_OF"）</li>
 *   <li>{@code sourceEntityId} / {@code targetEntityId} 是规范化主键</li>
 *   <li>{@code weight} 是关系强度（共现频次 / 置信度）</li>
 *   <li>{@code evidence} 是支持该关系的原始句子或块 ID（用于回溯）</li>
 * </ul>
 */
public class Relation {

    private String id;
    private String type = RelationType.RELATED_TO.name();
    private String sourceEntityName;
    private String targetEntityName;
    private long sourceEntityId;
    private long targetEntityId;
    private String workspace = "default";
    private String description;
    private double weight = 1.0;
    private int frequency;
    private List<String> evidenceChunkIds;
    private List<String> evidenceSentences;
    private Map<String, Object> properties = new LinkedHashMap<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public Relation() { this.id = UUID.randomUUID().toString(); }

    public Relation(String sourceEntityName, String type, String targetEntityName) {
        this();
        this.sourceEntityName = sourceEntityName;
        this.targetEntityName = targetEntityName;
        this.type = type;
    }

    public static Builder builder() { return new Builder(); }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getSourceEntityName() { return sourceEntityName; }
    public void setSourceEntityName(String sourceEntityName) { this.sourceEntityName = sourceEntityName; }
    public String getTargetEntityName() { return targetEntityName; }
    public void setTargetEntityName(String targetEntityName) { this.targetEntityName = targetEntityName; }
    public long getSourceEntityId() { return sourceEntityId; }
    public void setSourceEntityId(long sourceEntityId) { this.sourceEntityId = sourceEntityId; }
    public long getTargetEntityId() { return targetEntityId; }
    public void setTargetEntityId(long targetEntityId) { this.targetEntityId = targetEntityId; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }
    public int getFrequency() { return frequency; }
    public void setFrequency(int frequency) { this.frequency = frequency; }
    public List<String> getEvidenceChunkIds() { return evidenceChunkIds; }
    public void setEvidenceChunkIds(List<String> evidenceChunkIds) { this.evidenceChunkIds = evidenceChunkIds; }
    public List<String> getEvidenceSentences() { return evidenceSentences; }
    public void setEvidenceSentences(List<String> evidenceSentences) { this.evidenceSentences = evidenceSentences; }
    public Map<String, Object> getProperties() { return properties; }
    public void setProperties(Map<String, Object> properties) { this.properties = properties; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Builder {
        private final Relation r = new Relation();
        public Builder id(String v) { r.id = v; return this; }
        public Builder type(String v) { r.type = v; return this; }
        public Builder sourceEntityName(String v) { r.sourceEntityName = v; return this; }
        public Builder targetEntityName(String v) { r.targetEntityName = v; return this; }
        public Builder workspace(String v) { r.workspace = v; return this; }
        public Builder description(String v) { r.description = v; return this; }
        public Builder weight(double v) { r.weight = v; return this; }
        public Builder frequency(int v) { r.frequency = v; return this; }
        public Builder evidenceChunkIds(List<String> v) { r.evidenceChunkIds = v; return this; }
        public Builder evidenceSentences(List<String> v) { r.evidenceSentences = v; return this; }
        public Builder properties(Map<String, Object> v) { r.properties = v; return this; }
        public Relation build() { return r; }
    }
}
