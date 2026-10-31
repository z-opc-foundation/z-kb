package com.zifang.z.kb.web.api.v1.dto;

/**
 * 移除成员请求。
 */
public class MemberRevokeRequest {

    private String kbId;
    private String principalId;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getPrincipalId() {
        return principalId;
    }

    public void setPrincipalId(String principalId) {
        this.principalId = principalId;
    }
}
