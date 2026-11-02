package com.zifang.z.kb.web.api.v1.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量操作物料的请求（删除/恢复/彻底删除）。
 */
public class MaterialIdsRequest {

    private String kbId;
    private List<String> materialIds = new ArrayList<>();

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
}
