package com.zifang.z.kb.web.api.v1.dto;

/**
 * 触发编译请求。versionId 缺省时取物料当前版本。
 */
public class CompilationRunRequest {

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
