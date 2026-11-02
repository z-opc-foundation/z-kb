package com.zifang.z.kb.api.evaluation;

/**
 * 坏例状态流转参数。
 */
public class EvalBadcaseUpdateParam {

    private String badcaseId;
    private String status;
    private String owner;
    private String note;

    public String getBadcaseId() {
        return badcaseId;
    }

    public void setBadcaseId(String badcaseId) {
        this.badcaseId = badcaseId;
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
}
