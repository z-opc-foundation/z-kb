package com.zifang.z.kb.api.source;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 同步执行用的完整接入源配置：含凭据，只在服务层内部流转，不对外返回。
 */
public class KnowledgeBaseSourceAccess {

    private String sourceId;
    private String category;
    private String provider;
    private String name;
    private Boolean enabled;
    private Map<String, Object> scope = new LinkedHashMap<>();
    private String credentialType;
    private String credentialUsername;
    private String secret;
    private String secretRef;

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

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getSecretRef() {
        return secretRef;
    }

    public void setSecretRef(String secretRef) {
        this.secretRef = secretRef;
    }

    /** 取 scope 里的字符串值，缺失或空白返回 null。 */
    public String scopeValue(String key) {
        Object value = scope == null ? null : scope.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    /** 凭据优先取明文，其次按 secretRef 读环境变量或系统属性。 */
    public String resolveSecret() {
        if (secret != null && !secret.trim().isEmpty()) {
            return secret.trim();
        }
        if (secretRef == null || secretRef.trim().isEmpty()) {
            return null;
        }
        String ref = secretRef.trim();
        String value = System.getenv(ref);
        return value != null ? value : System.getProperty(ref);
    }
}
