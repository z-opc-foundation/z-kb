package com.zifang.z.kb.api.material;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 分类树节点。nodeKind 为 FOLDER 时是普通分类；SOURCE / SOURCE_BOOK / SOURCE_REPO 是接入源同步出来的只读节点，
 * 绑定信息在 ext 里（sourceId、namespace、book 等），供页面标识与后续操作使用。
 */
public class MaterialCategoryNode {

    private String categoryId;
    private String parentId;
    private String name;
    private Integer sortNo;
    private String nodeKind;
    private Map<String, Object> ext;
    private List<MaterialCategoryNode> children = new ArrayList<>();

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSortNo() {
        return sortNo;
    }

    public void setSortNo(Integer sortNo) {
        this.sortNo = sortNo;
    }

    public String getNodeKind() {
        return nodeKind;
    }

    public void setNodeKind(String nodeKind) {
        this.nodeKind = nodeKind;
    }

    public Map<String, Object> getExt() {
        return ext;
    }

    public void setExt(Map<String, Object> ext) {
        this.ext = ext;
    }

    public List<MaterialCategoryNode> getChildren() {
        return children;
    }

    public void setChildren(List<MaterialCategoryNode> children) {
        this.children = children;
    }
}
