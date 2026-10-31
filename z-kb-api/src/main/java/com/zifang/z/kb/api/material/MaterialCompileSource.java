package com.zifang.z.***REMOVED***.api.material;

/**
 * 编译输入来源。物料是唯一事实源，编译域通过本对象读取已解析正文。
 */
public class MaterialCompileSource {

    private String materialId;
    private String ***REMOVED***Id;
    private String title;
    private String versionId;
    private Integer versionNo;
    private String versionStatus;
    private String fileName;
    private String draftId;
    private String draftStatus;
    private String draftFailureReason;
    private String textContent;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getVersionId() {
        return versionId;
    }

    public void setVersionId(String versionId) {
        this.versionId = versionId;
    }

    public Integer getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public String getVersionStatus() {
        return versionStatus;
    }

    public void setVersionStatus(String versionStatus) {
        this.versionStatus = versionStatus;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getDraftId() {
        return draftId;
    }

    public void setDraftId(String draftId) {
        this.draftId = draftId;
    }

    public String getDraftStatus() {
        return draftStatus;
    }

    public void setDraftStatus(String draftStatus) {
        this.draftStatus = draftStatus;
    }

    public String getDraftFailureReason() {
        return draftFailureReason;
    }

    public void setDraftFailureReason(String draftFailureReason) {
        this.draftFailureReason = draftFailureReason;
    }

    public String getTextContent() {
        return textContent;
    }

    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }
}
