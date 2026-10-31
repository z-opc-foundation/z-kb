package com.zifang.z.kb.api.compilation;

/**
 * 作业冻结的输入条目，多文件作业用它展示成员。
 */
public class CompilationScopeView {

    private String materialId;
    private String materialVersionId;
    private String title;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
