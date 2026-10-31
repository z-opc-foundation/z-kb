package com.zifang.z.***REMOVED***.web.api.v1.dto;

/**
 * 按附件地址登记资料；地址取值来自上传会话附件的返回值。
 */
public class MaterialUrlRegisterRequest {

    private String ***REMOVED***Id;
    private String title;
    private String fileName;
    private String categoryId;
    private String url;

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

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
