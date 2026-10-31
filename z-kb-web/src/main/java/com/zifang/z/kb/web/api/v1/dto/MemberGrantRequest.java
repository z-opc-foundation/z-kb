package com.zifang.z.***REMOVED***.web.api.v1.dto;

/**
 * 授予/变更成员角色请求。
 */
public class MemberGrantRequest {

    private String ***REMOVED***Id;
    private String principalId;
    private String role;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
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
