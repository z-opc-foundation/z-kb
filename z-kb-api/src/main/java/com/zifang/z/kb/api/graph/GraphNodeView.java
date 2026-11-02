package com.zifang.z.kb.api.graph;

/**
 * 图谱节点视图：物料节点或概念节点。
 */
public class GraphNodeView {

    private String nodeId;
    private String nodeType;
    private String conceptId;
    private String name;
    private String materialId;
    private String evidence;
    /**
     * 节点标签（TASK-20261101-006）：命中 z-cognition 概念的概念节点带 {@code Cog:{认知键}}。
     *
     * <p>本体图谱页靠它把知识库涌现的概念与公司级认知资产对上号 ——
     * 没有这个标签，前端无法区分「只是库里涌现的词」和「已对齐到公司语义的词」。</p>
     */
    private String labels;

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public String getNodeType() {
        return nodeType;
    }

    public void setNodeType(String nodeType) {
        this.nodeType = nodeType;
    }

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

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getLabels() {
        return labels;
    }

    public void setLabels(String labels) {
        this.labels = labels;
    }
}
