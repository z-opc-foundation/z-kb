package com.zifang.z.kb.web.api.v1.dto;

/**
 * 新建分类请求；parentId 为空表示建在根层级。
 */
public class CategoryAddRequest {

    private String kbId;
    private String parentId;
    private String name;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
