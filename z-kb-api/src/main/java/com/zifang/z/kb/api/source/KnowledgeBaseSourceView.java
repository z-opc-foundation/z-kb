package com.zifang.z.kb.api.source;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 接入源对外视图：凭据只回 hasSecret，不返回明文。
 */
public class KnowledgeBaseSourceView {

    private String sourceId;
    private String category;
    private String provider;
    private String name;
    private Boolean enabled;
    private Map<String, Object> scope = new LinkedHashMap<>();
    private String credentialType;
    private String credentialUsername;
    private String secretRef;
    private Boolean hasSecret;

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public Map<String, Object> getScope() {
        return scope;
    }

    public void setScope(Map<String, Object> scope) {
        this.scope = scope;
    }

    public String getCredentialType() {
        return credentialType;
    }

    public void setCredentialType(String credentialType) {
        this.credentialType = credentialType;
    }

    public String getCredentialUsername() {
        return credentialUsername;
    }

    public void setCredentialUsername(String credentialUsername) {
        this.credentialUsername = credentialUsername;
    }

    public String getSecretRef() {
        return secretRef;
    }

    public void setSecretRef(String secretRef) {
        this.secretRef = secretRef;
    }

    public Boolean getHasSecret() {
        return hasSecret;
    }

    public void setHasSecret(Boolean hasSecret) {
        this.hasSecret = hasSecret;
    }
}
