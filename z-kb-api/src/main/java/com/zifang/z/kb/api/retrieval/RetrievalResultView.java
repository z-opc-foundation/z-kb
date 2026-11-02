package com.zifang.z.kb.api.retrieval;

import java.util.ArrayList;
import java.util.List;

/**
 * 库内检索结果：检索参数回显、扫描统计与命中列表。
 */
public class RetrievalResultView {

    private String kbId;
    private String query;
    private String mode;
    private String embeddingModel;
    private int topK;
    private double minScore;
    private long totalCandidates;
    private int scanned;
    private int returned;
    private boolean truncated;
    private long tookMs;
    private List<RetrievalHitView> hits = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public int getTopK() {
        return topK;
    }

    public void setTopK(int topK) {
        this.topK = topK;
    }

    public double getMinScore() {
        return minScore;
    }

    public void setMinScore(double minScore) {
        this.minScore = minScore;
    }

    public long getTotalCandidates() {
        return totalCandidates;
    }

    public void setTotalCandidates(long totalCandidates) {
        this.totalCandidates = totalCandidates;
    }

    public int getScanned() {
        return scanned;
    }

    public void setScanned(int scanned) {
        this.scanned = scanned;
    }

    public int getReturned() {
        return returned;
    }

    public void setReturned(int returned) {
        this.returned = returned;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }

    public long getTookMs() {
        return tookMs;
    }

    public void setTookMs(long tookMs) {
        this.tookMs = tookMs;
    }

    public List<RetrievalHitView> getHits() {
        return hits;
    }

    public void setHits(List<RetrievalHitView> hits) {
        this.hits = hits;
    }
}
