package com.zifang.z.kb.api.extraction;

/**
 * 单条萃取条目视图，携带可选的关联概念。
 */
public class ExtractionItemView {

    private String itemId;
    private String itemType;
    private Integer seq;
    private String title;
    private String content;
    private String evidence;
    private String conceptId;
    private String conceptName;
    private String conceptStatus;

    public String getItemId() {
        return itemId;
    }

    public void setItemId(String itemId) {
        this.itemId = itemId;
    }

    public String getItemType() {
        return itemType;
    }

    public void setItemType(String itemType) {
        this.itemType = itemType;
    }

    public Integer getSeq() {
        return seq;
    }

    public void setSeq(Integer seq) {
        this.seq = seq;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getConceptId() {
        return conceptId;
    }

    public void setConceptId(String conceptId) {
        this.conceptId = conceptId;
    }

    public String getConceptName() {
        return conceptName;
    }

    public void setConceptName(String conceptName) {
        this.conceptName = conceptName;
    }

    public String getConceptStatus() {
        return conceptStatus;
    }

    public void setConceptStatus(String conceptStatus) {
        this.conceptStatus = conceptStatus;
    }
}
