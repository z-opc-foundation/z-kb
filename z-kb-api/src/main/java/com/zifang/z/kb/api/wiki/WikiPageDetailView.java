package com.zifang.z.kb.api.wiki;

import java.util.ArrayList;
import java.util.List;

/**
 * Wiki 详情：页面、要点、来源与来源物料图谱节点数。
 */
public class WikiPageDetailView {

    private WikiPageView page;
    private List<WikiPointView> points = new ArrayList<>();
    private List<WikiSourceView> sources = new ArrayList<>();
    private int graphNodeCount;
    private String note;

    public WikiPageView getPage() {
        return page;
    }

    public void setPage(WikiPageView page) {
        this.page = page;
    }

    public List<WikiPointView> getPoints() {
        return points;
    }

    public void setPoints(List<WikiPointView> points) {
        this.points = points;
    }

    public List<WikiSourceView> getSources() {
        return sources;
    }

    public void setSources(List<WikiSourceView> sources) {
        this.sources = sources;
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
