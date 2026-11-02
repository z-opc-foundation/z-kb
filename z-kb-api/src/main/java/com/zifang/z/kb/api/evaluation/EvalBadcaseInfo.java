package com.zifang.z.kb.api.evaluation;

/**
 * 坏例台账单条记录。
 */
public class EvalBadcaseInfo {

    private String badcaseId;
    private String caseId;
    private String question;
    private String stageCode;
    private String category;
    private String severity;
    private String status;
    private String owner;
    private String note;
    private Integer occurrenceCount;
    private String lastSeenRunId;

    public String getBadcaseId() {
        return badcaseId;
    }

    public void setBadcaseId(String badcaseId) {
        this.badcaseId = badcaseId;
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Integer getOccurrenceCount() {
        return occurrenceCount;
    }

    public void setOccurrenceCount(Integer occurrenceCount) {
        this.occurrenceCount = occurrenceCount;
    }

    public String getLastSeenRunId() {
        return lastSeenRunId;
    }

    public void setLastSeenRunId(String lastSeenRunId) {
        this.lastSeenRunId = lastSeenRunId;
    }
}
