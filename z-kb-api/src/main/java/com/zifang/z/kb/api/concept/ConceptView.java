package com.zifang.z.kb.api.concept;

/**
 * 概念模型视图：由编译萃取涌现，按规范化名称归一到知识库级。
 */
public class ConceptView {

    private String conceptId;
    private String name;
    private String conceptType;
    private String status;
    private String definition;
    private Integer mentionCount;
    private Integer materialCount;
    private String firstMaterialId;
    private String lastMaterialId;
    private String graphNodeId;
    private String evidence;

    public String getConceptId() {
        return conceptId;
    }

    public void setConceptId(String conceptId) {
        this.conceptId = conceptId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getConceptType() {
        return conceptType;
    }

    public void setConceptType(String conceptType) {
        this.conceptType = conceptType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDefinition() {
        return definition;
    }

    public void setDefinition(String definition) {
        this.definition = definition;
    }

    public Integer getMentionCount() {
        return mentionCount;
    }

    public void setMentionCount(Integer mentionCount) {
        this.mentionCount = mentionCount;
    }

    public Integer getMaterialCount() {
        return materialCount;
    }

    public void setMaterialCount(Integer materialCount) {
        this.materialCount = materialCount;
    }

    public String getFirstMaterialId() {
        return firstMaterialId;
    }

    public void setFirstMaterialId(String firstMaterialId) {
        this.firstMaterialId = firstMaterialId;
    }

    public String getLastMaterialId() {
        return lastMaterialId;
    }

    public void setLastMaterialId(String lastMaterialId) {
        this.lastMaterialId = lastMaterialId;
    }

    public String getGraphNodeId() {
        return graphNodeId;
    }

    public void setGraphNodeId(String graphNodeId) {
        this.graphNodeId = graphNodeId;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }
}
