package com.zifang.z.***REMOVED***.web.api.v1.dto;

/**
 * 把一段文本（通常为 Markdown）登记为资料。
 */
public class MaterialTextRegisterRequest {

    private String ***REMOVED***Id;
    private String title;
    private String categoryId;
    private String content;

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

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
