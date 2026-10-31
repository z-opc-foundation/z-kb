package com.zifang.z.***REMOVED***.api.material;

/**
 * 代码仓库物料在来源侧的坐标。浏览项目文件时据此还原仓库配置，不承载文件内容。
 */
public class MaterialRepoRef {

    private String materialId;
    private String ***REMOVED***Id;
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
