package com.zifang.z.kb.api.graph;

import java.util.ArrayList;
import java.util.List;

/**
 * 图谱视图：节点与边各上限 200，超出时标记截断。
 */
public class GraphView {

    private String kbId;
    private String graphSpaceKey;
    private long nodeCount = 0;
    private long edgeCount = 0;
    private boolean truncated = false;
    private List<GraphNodeView> nodes = new ArrayList<>();
    private List<GraphEdgeView> edges = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getGraphSpaceKey() {
        return graphSpaceKey;
    }

    public void setGraphSpaceKey(String graphSpaceKey) {
        this.graphSpaceKey = graphSpaceKey;
    }

    public long getNodeCount() {
        return nodeCount;
    }

    public void setNodeCount(long nodeCount) {
        this.nodeCount = nodeCount;
    }

    public long getEdgeCount() {
        return edgeCount;
    }

    public void setEdgeCount(long edgeCount) {
        this.edgeCount = edgeCount;
    }

    public boolean getTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }

    public List<GraphNodeView> getNodes() {
        return nodes;
    }

    public void setNodes(List<GraphNodeView> nodes) {
        this.nodes = nodes;
    }

    public List<GraphEdgeView> getEdges() {
        return edges;
    }

    public void setEdges(List<GraphEdgeView> edges) {
        this.edges = edges;
    }
}
