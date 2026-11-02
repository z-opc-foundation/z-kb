package com.zifang.z.kb.web.api.v1.dto;

/**
 * 仅携带分类标识的请求（删除分类）。
 */
public class CategoryIdRequest {

    private String categoryId;

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }
}
