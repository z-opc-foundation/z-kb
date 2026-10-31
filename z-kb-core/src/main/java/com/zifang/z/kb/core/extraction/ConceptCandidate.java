package com.zifang.z.kb.core.extraction;

/**
 * 概念候选：由概念节点涌现，术语条目命中时补上释义、条目 ID、块序号与出现次数。
 */
public class ConceptCandidate {

    private String name;
    private String definition;
    private String extractionItemId;
    private Integer chunkOrdinal;
    private Integer occurrenceCount;
    private String evidenceJson;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDefinition() {
        return definition;
    }

    public void setDefinition(String definition) {
        this.definition = definition;
    }

    public String getExtractionItemId() {
        return extractionItemId;
    }

    public void setExtractionItemId(String extractionItemId) {
        this.extractionItemId = extractionItemId;
    }

    public Integer getChunkOrdinal() {
        return chunkOrdinal;
    }

    public void setChunkOrdinal(Integer chunkOrdinal) {
        this.chunkOrdinal = chunkOrdinal;
    }

    public Integer getOccurrenceCount() {
        return occurrenceCount;
    }

    public void setOccurrenceCount(Integer occurrenceCount) {
        this.occurrenceCount = occurrenceCount;
    }

    public String getEvidenceJson() {
        return evidenceJson;
    }

    public void setEvidenceJson(String evidenceJson) {
        this.evidenceJson = evidenceJson;
    }
}
