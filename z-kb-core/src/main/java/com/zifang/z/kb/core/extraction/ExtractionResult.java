package com.zifang.z.kb.core.extraction;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次萃取的输出：条目、图谱节点/边与概念候选，均未落库。
 */
public class ExtractionResult {

    private List<ExtractionItemDraft> items = new ArrayList<>();
    private List<ExtractionNodeDraft> nodes = new ArrayList<>();
    private List<ExtractionEdgeDraft> edges = new ArrayList<>();
    private List<ConceptCandidate> concepts = new ArrayList<>();

    public List<ExtractionItemDraft> getItems() {
        return items;
    }

    public void setItems(List<ExtractionItemDraft> items) {
        this.items = items;
    }

    public List<ExtractionNodeDraft> getNodes() {
        return nodes;
    }

    public void setNodes(List<ExtractionNodeDraft> nodes) {
        this.nodes = nodes;
    }

    public List<ExtractionEdgeDraft> getEdges() {
        return edges;
    }

    public void setEdges(List<ExtractionEdgeDraft> edges) {
        this.edges = edges;
    }

    public List<ConceptCandidate> getConcepts() {
        return concepts;
    }

    public void setConcepts(List<ConceptCandidate> concepts) {
        this.concepts = concepts;
    }
}
