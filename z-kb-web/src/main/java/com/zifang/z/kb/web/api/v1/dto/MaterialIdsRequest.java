package com.zifang.z.***REMOVED***.web.api.v1.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量操作物料的请求（删除/恢复/彻底删除）。
 */
public class MaterialIdsRequest {

    private String ***REMOVED***Id;
    private List<String> materialIds = new ArrayList<>();

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public List<String> getMaterialIds() {
        return materialIds;
    }

    public void setMaterialIds(List<String> materialIds) {
        this.materialIds = materialIds;
    }
}
