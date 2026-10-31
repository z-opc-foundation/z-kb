package com.zifang.z.kb.web.api.v1.dto;

/**
 * 授予/变更成员角色请求。
 */
public class MemberGrantRequest {

    private String kbId;
    private String principalId;
    private String role;

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

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
