package com.zifang.z.kb.web.api.v1.dto;

/**
 * 把一段文本（通常为 Markdown）登记为资料。
 */
public class MaterialTextRegisterRequest {

    private String kbId;
    private String title;
    private String categoryId;
    private String content;

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
