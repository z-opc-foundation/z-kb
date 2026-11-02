package com.zifang.z.kb.api.compilation;

import java.util.ArrayList;
import java.util.List;

/**
 * 创建编译作业的范围参数。单文件作业只有一个物料，批量作业按多选或分类展开。
 */
public class CompilationScopeParam {

    private String kbId;
    private String name;
    private String taskType;
    private String scopeType;
    private String scopeId;
    private List<String> materialIds = new ArrayList<>();
    private List<String> versionIds = new ArrayList<>();

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

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
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

    public List<String> getVersionIds() {
        return versionIds;
    }

    public void setVersionIds(List<String> versionIds) {
        this.versionIds = versionIds;
    }
}
