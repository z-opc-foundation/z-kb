package com.zifang.z.kb.api.wiki;

/**
 * Wiki 来源资料快照。
 */
public class WikiSourceView {

    private String materialId;
    private String materialVersionId;
    private String materialTitle;
    private Integer sourceVersionNo;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getMaterialTitle() {
        return materialTitle;
    }

    public void setMaterialTitle(String materialTitle) {
        this.materialTitle = materialTitle;
    }

    public Integer getSourceVersionNo() {
        return sourceVersionNo;
    }

    public void setSourceVersionNo(Integer sourceVersionNo) {
        this.sourceVersionNo = sourceVersionNo;
    }
}
