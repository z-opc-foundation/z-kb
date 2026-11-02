package com.zifang.z.kb.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 图谱查询结果 — 用于图谱可视化（前端 D3/G6）。
 */
public class GraphQueryResult {

    private List<Entity> nodes = new ArrayList<>();
    private List<Relation> edges = new ArrayList<>();
    private Map<String, Object> meta = new LinkedHashMap<>();

    public List<Entity> getNodes() { return nodes; }
    public void setNodes(List<Entity> nodes) { this.nodes = nodes; }
    public List<Relation> getEdges() { return edges; }
    public void setEdges(List<Relation> edges) { this.edges = edges; }
    public Map<String, Object> getMeta() { return meta; }
    public void setMeta(Map<String, Object> meta) { this.meta = meta; }
}
