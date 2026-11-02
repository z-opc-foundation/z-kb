package com.zifang.z.kb.api.material;

/**
 * 批量操作逐条结果。批量不做“假整批成功”。
 */
public class MaterialBatchItem {

    private String materialId;
    private boolean success;
    private String message;

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
