package com.zifang.z.kb.api.wiki;

/**
 * 血缘节点：WIKI / MATERIAL / CONCEPT 等类型。
 */
public class WikiLineageNodeView {

    private String nodeId;
    private String nodeType;
    private String label;
    private String refId;

    public WikiLineageNodeView() {
    }

    public WikiLineageNodeView(String nodeId, String nodeType, String label, String refId) {
        this.nodeId = nodeId;
        this.nodeType = nodeType;
        this.label = label;
        this.refId = refId;
    }

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

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getRefId() {
        return refId;
    }

    public void setRefId(String refId) {
        this.refId = refId;
    }
}
