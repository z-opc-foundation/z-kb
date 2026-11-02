package com.zifang.z.kb.api.wiki;

/**
 * Wiki 编译提交参数：按物料版本生成。
 */
public class WikiCompileParam {

    private String kbId;
    private String materialId;
    private String versionId;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getVersionId() {
        return versionId;
    }

    public void setVersionId(String versionId) {
        this.versionId = versionId;
    }
}
