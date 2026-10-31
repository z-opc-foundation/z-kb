package com.zifang.z.kb.web.api.v1.dto;

import com.zifang.z.kb.api.material.MaterialQuery;

/**
 * 物料分页请求（回收站复用同一形状）。
 */
public class MaterialPageRequest {

    private String kbId;
    private String keyword;
    private String categoryId;
    private String materialType;
    private String materialStatus;
    private long current = 1;
    private long size = 10;

    public MaterialQuery toQuery() {
        MaterialQuery query = new MaterialQuery();
        query.setKeyword(keyword);
        query.setCategoryId(categoryId);
        query.setMaterialType(materialType);
        query.setMaterialStatus(materialStatus);
        query.setCurrent(current);
        query.setSize(size);
        return query;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getMaterialType() {
        return materialType;
    }

    public void setMaterialType(String materialType) {
        this.materialType = materialType;
    }

    public String getMaterialStatus() {
        return materialStatus;
    }

    public void setMaterialStatus(String materialStatus) {
        this.materialStatus = materialStatus;
    }

    public long getCurrent() {
        return current;
    }

    public void setCurrent(long current) {
        this.current = current;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }
}
