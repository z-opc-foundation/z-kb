package com.zifang.z.kb.api.material;

/**
 * 接入源同步在物料侧的登记结果。只描述这次登记做了什么，不代表解析/编译已完成。
 */
public class MaterialSyncResult {

    /** 新建了物料并与来源建立绑定。 */
    public static final String CREATED = "CREATED";

    /** 物料内容变化，已追加新版本。 */
    public static final String UPDATED = "UPDATED";

    /** 内容与当前版本一致，未产生新版本。 */
    public static final String UNCHANGED = "UNCHANGED";

    /** 同库已存在相同内容，本次未登记。 */
    public static final String DUPLICATE = "DUPLICATE";

    /** 登记失败，message 带原因。 */
    public static final String FAILED = "FAILED";

    private String status;
    private String materialId;
    private String versionId;
    private String message;

    public static MaterialSyncResult of(String status, String materialId, String versionId, String message) {
        MaterialSyncResult result = new MaterialSyncResult();
        result.status = status;
        result.materialId = materialId;
        result.versionId = versionId;
        result.message = message;
        return result;
    }

    public static MaterialSyncResult failed(String message) {
        return of(FAILED, null, null, message);
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
