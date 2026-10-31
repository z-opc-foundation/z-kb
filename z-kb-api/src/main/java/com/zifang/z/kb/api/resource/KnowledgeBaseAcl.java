package com.zifang.z.kb.api.resource;

import java.time.Instant;

/**
 * 知识库成员授权（库级 ACL）。
 */
public class KnowledgeBaseAcl {

    private String aclId;
    private String kbId;
    private String tenantCode;
    private String principalId;
    private PrincipalType principalType = PrincipalType.USER;
    private KnowledgeBaseRole role = KnowledgeBaseRole.READER;
    private String grantedBy;
    private Instant grantedAt;
    private Instant expiresAt;

    public String getAclId() {
        return aclId;
    }

    public void setAclId(String aclId) {
        this.aclId = aclId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getTenantCode() {
        return tenantCode;
    }

    public void setTenantCode(String tenantCode) {
        this.tenantCode = tenantCode;
    }

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
}
