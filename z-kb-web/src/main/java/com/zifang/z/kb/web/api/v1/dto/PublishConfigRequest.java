package com.zifang.z.kb.web.api.v1.dto;

/**
 * 发布配置请求。
 */
public class PublishConfigRequest {

    private String kbId;
    private String remark;
    private Boolean confirm;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public Boolean getConfirm() {
        return confirm;
    }

    public void setConfirm(Boolean confirm) {
        this.confirm = confirm;
    }
}
