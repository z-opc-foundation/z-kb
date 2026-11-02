package com.zifang.z.kb.api.wiki;

import java.util.ArrayList;
import java.util.List;

/**
 * Wiki 血缘：物料经 SOURCED_FROM 指向 Wiki，并补充来源物料的图谱节点与边。
 */
public class WikiLineageView {

    private String wikiId;
    private String title;
    private List<WikiLineageNodeView> nodes = new ArrayList<>();
    private List<WikiLineageEdgeView> edges = new ArrayList<>();
    private List<String> relationTypes = new ArrayList<>();
    private int sourceCount;
    private int graphNodeCount;
    private String note;

    public String getWikiId() {
        return wikiId;
    }

    public void setWikiId(String wikiId) {
        this.wikiId = wikiId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<WikiLineageNodeView> getNodes() {
        return nodes;
    }

    public void setNodes(List<WikiLineageNodeView> nodes) {
        this.nodes = nodes;
    }

    public List<WikiLineageEdgeView> getEdges() {
        return edges;
    }

    public void setEdges(List<WikiLineageEdgeView> edges) {
        this.edges = edges;
    }

    public List<String> getRelationTypes() {
        return relationTypes;
    }

    public void setRelationTypes(List<String> relationTypes) {
        this.relationTypes = relationTypes;
    }

    public int getSourceCount() {
        return sourceCount;
    }

    public void setSourceCount(int sourceCount) {
        this.sourceCount = sourceCount;
    }

    public int getGraphNodeCount() {
        return graphNodeCount;
    }

    public void setGraphNodeCount(int graphNodeCount) {
        this.graphNodeCount = graphNodeCount;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
