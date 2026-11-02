package com.zifang.z.kb.api.concept;

/**
 * 概念提及视图：一个物料版本对一个概念的一次涌现。
 */
public class ConceptMentionView {

    private String mentionId;
    private String conceptId;
    private String materialId;
    private String materialTitle;
    private String materialVersionId;
    private String extractionItemId;
    private Integer chunkOrdinal;
    private Integer occurrenceCount;
    private String evidence;

    public String getMentionId() {
        return mentionId;
    }

    public void setMentionId(String mentionId) {
        this.mentionId = mentionId;
    }

    public String getConceptId() {
        return conceptId;
    }

    public void setConceptId(String conceptId) {
        this.conceptId = conceptId;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialTitle() {
        return materialTitle;
    }

    public void setMaterialTitle(String materialTitle) {
        this.materialTitle = materialTitle;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
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

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }
}
