package com.zifang.z.kb.api.resource;

import java.time.Instant;

/**
 * 知识库成员视图（对齐参考实现 KnowledgeBaseMemberResponse）。
 *
 * <p>姓名/工号/部门来自 {@link KbPrincipalDirectory}，目录不可用时留空。</p>
 */
public class KnowledgeBaseMember {

    private String principalId;
    private PrincipalType principalType;
    private KnowledgeBaseRole role;
    private boolean owner;
    private String grantedBy;
    private Instant grantedAt;
    private Instant expiresAt;
    private String name;
    private String employeeId;
    private String dept;

    public String getPrincipalId() {
        return principalId;
    }

    public void setPrincipalId(String principalId) {
        this.principalId = principalId;
    }

    public PrincipalType getPrincipalType() {
        return principalType;
    }

    public void setPrincipalType(PrincipalType principalType) {
        this.principalType = principalType;
    }

    public KnowledgeBaseRole getRole() {
        return role;
    }

    public void setRole(KnowledgeBaseRole role) {
        this.role = role;
    }

    public boolean isOwner() {
        return owner;
    }

    public void setOwner(boolean owner) {
        this.owner = owner;
    }

    public String getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(String grantedBy) {
        this.grantedBy = grantedBy;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(Instant grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(String employeeId) {
        this.employeeId = employeeId;
    }

    public String getDept() {
        return dept;
    }

    public void setDept(String dept) {
        this.dept = dept;
    }
}
