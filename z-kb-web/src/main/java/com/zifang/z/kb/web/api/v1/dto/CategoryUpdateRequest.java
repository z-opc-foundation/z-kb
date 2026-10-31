package com.zifang.z.kb.web.api.v1.dto;

/**
 * 重命名分类请求。
 */
public class CategoryUpdateRequest {

    private String categoryId;
    private String name;

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
