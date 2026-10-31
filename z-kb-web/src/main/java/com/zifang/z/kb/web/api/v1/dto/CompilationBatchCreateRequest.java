package com.zifang.z.***REMOVED***.web.api.v1.dto;

import com.zifang.z.***REMOVED***.api.compilation.CompilationBatchCreateParam;

import java.util.ArrayList;
import java.util.List;

/**
 * 新建编译组别请求。materialIds 留空时按 scopeId 解析范围。
 */
public class CompilationBatchCreateRequest {

    private String ***REMOVED***Id;
    private String name;
    private String scopeType;
    private String scopeId;
    private List<String> materialIds = new ArrayList<>();

    public CompilationBatchCreateParam toParam() {
        CompilationBatchCreateParam param = new CompilationBatchCreateParam();
        param.set***REMOVED***Id(***REMOVED***Id);
        param.setName(name);
        param.setScopeType(scopeType);
        param.setScopeId(scopeId);
        param.setMaterialIds(materialIds);
        return param;
    }

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getScopeId() {
        return scopeId;
    }

    public void setScopeId(String scopeId) {
        this.scopeId = scopeId;
    }

    public List<String> getMaterialIds() {
        return materialIds;
    }

    public void setMaterialIds(List<String> materialIds) {
        this.materialIds = materialIds;
    }
}
