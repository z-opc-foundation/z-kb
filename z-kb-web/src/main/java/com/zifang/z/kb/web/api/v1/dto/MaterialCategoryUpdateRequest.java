package com.zifang.z.kb.web.api.v1.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量调整物料分类的请求；categoryId 为空表示移出分类。
 */
public class MaterialCategoryUpdateRequest {

    private String kbId;
    private List<String> materialIds = new ArrayList<>();
    private String categoryId;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public List<String> getMaterialIds() {
        return materialIds;
    }

    public void setMaterialIds(List<String> materialIds) {
        this.materialIds = materialIds;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }
}
