package com.zifang.z.kb.api.material;

/**
 * 代码仓库物料在来源侧的坐标。浏览项目文件时据此还原仓库配置，不承载文件内容。
 */
public class MaterialRepoRef {

    private String materialId;
    private String kbId;
    private String title;
    private String sourceType;
    private String sourceBindingId;
    private String metadata;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceBindingId() {
        return sourceBindingId;
    }

    public void setSourceBindingId(String sourceBindingId) {
        this.sourceBindingId = sourceBindingId;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
}
