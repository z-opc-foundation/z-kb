package com.zifang.z.kb.web.api.v1.dto;

/**
 * 移动分类请求；parentId 为空表示移到根层级。
 */
public class CategoryMoveRequest {

    private String categoryId;
    private String parentId;

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }
}
