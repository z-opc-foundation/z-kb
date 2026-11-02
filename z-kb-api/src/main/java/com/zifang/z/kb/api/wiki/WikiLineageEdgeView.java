package com.zifang.z.kb.api.wiki;

/**
 * 血缘边：关系类型为 SOURCED_FROM / MENTIONS / RELATED_TO。
 */
public class WikiLineageEdgeView {

    private String fromNodeId;
    private String toNodeId;
    private String relation;

    public WikiLineageEdgeView() {
    }

    public WikiLineageEdgeView(String fromNodeId, String toNodeId, String relation) {
        this.fromNodeId = fromNodeId;
        this.toNodeId = toNodeId;
        this.relation = relation;
    }

    public String getFromNodeId() {
        return fromNodeId;
    }

    public void setFromNodeId(String fromNodeId) {
        this.fromNodeId = fromNodeId;
    }

    public String getToNodeId() {
        return toNodeId;
    }

    public void setToNodeId(String toNodeId) {
        this.toNodeId = toNodeId;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }
}
