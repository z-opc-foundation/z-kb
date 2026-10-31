package com.zifang.z.kb.web.api.v1.dto;

/**
 * 重新解析请求；versionId 为空表示当前版本。
 */
public class MaterialReparseRequest {

    private String materialId;
    private String versionId;

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
}
