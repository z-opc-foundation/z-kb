package com.zifang.z.kb.web.api.v1.dto;

/**
 * 保存人工编辑后的解析稿正文；versionId 为空表示当前版本。
 */
public class MaterialDraftSaveRequest {

    private String materialId;
    private String versionId;
    private String textContent;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getVersionId() {
        return versionId;
    }

    public void setVersionId(String versionId) {
        this.versionId = versionId;
    }

    public String getTextContent() {
        return textContent;
    }

    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }
}
