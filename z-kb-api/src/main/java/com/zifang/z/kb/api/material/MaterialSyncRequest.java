package com.zifang.z.***REMOVED***.api.material;

/**
 * 接入源同步推进到物料侧的一次登记请求。
 * materialId 为空表示新建物料，非空表示给已有物料追加一版；内容未变时物料侧直接跳过。
 */
public class MaterialSyncRequest {

    private String ***REMOVED***Id;
    private String materialId;
    private String categoryId;
    private String title;
    private String fileName;
    private byte[] content;
    private String sourceType;
    private String sourceBindingId;
    private String sourceVersion;
    private String metadata;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public byte[] getContent() {
        return content;
    }

    public void setContent(byte[] content) {
        this.content = content;
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

    public String getSourceVersion() {
        return sourceVersion;
    }

    public void setSourceVersion(String sourceVersion) {
        this.sourceVersion = sourceVersion;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
}
