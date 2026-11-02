package com.zifang.z.kb.api.compilation;

import java.util.ArrayList;
import java.util.List;

/**
 * 新建编译组别参数。范围为工作台多选或分类节点。
 */
public class CompilationBatchCreateParam {

    private String kbId;
    private String name;
    private String scopeType;
    private String scopeId;
    private List<String> materialIds = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
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
