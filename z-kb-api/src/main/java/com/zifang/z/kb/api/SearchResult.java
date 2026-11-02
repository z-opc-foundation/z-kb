package com.zifang.z.kb.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 检索结果聚合。
 */
public class SearchResult {

    private String query;
    private SearchMode mode;
    private long elapsedMillis;
    private int totalHits;
    private List<SearchHit> hits = new ArrayList<>();
    /** 召回统计（每路命中的 chunk 数） */
    private Map<String, Integer> stats = new LinkedHashMap<>();
    /** 命中的实体列表（图谱召回时填充） */
    private List<Entity> matchedEntities = new ArrayList<>();

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
    public SearchMode getMode() { return mode; }
    public void setMode(SearchMode mode) { this.mode = mode; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public int getTotalHits() { return totalHits; }
    public void setTotalHits(int totalHits) { this.totalHits = totalHits; }
    public List<SearchHit> getHits() { return hits; }
    public void setHits(List<SearchHit> hits) { this.hits = hits; }
    public Map<String, Integer> getStats() { return stats; }
    public void setStats(Map<String, Integer> stats) { this.stats = stats; }
    public List<Entity> getMatchedEntities() { return matchedEntities; }
    public void setMatchedEntities(List<Entity> matchedEntities) { this.matchedEntities = matchedEntities; }
}
