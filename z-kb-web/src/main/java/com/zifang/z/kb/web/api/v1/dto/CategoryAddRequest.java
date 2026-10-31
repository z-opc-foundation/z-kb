package com.zifang.z.***REMOVED***.web.api.v1.dto;

/**
 * 新建分类请求；parentId 为空表示建在根层级。
 */
public class CategoryAddRequest {

    private String ***REMOVED***Id;
    private String parentId;
    private String name;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
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
