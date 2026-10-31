package com.zifang.z.kb.core.source;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 接入源列表在 {@code zkb_knowledge_base_profile.source_policy} 里的存储结构。
 *
 * <p>用 Map 读写而不是反射绑 POJO：z-util JsonUtil 的 POJO 绑定语义与 Jackson 有差异，
 * 这里字段少、结构固定，显式取值更稳。凭据只在这份 JSON 内，读取时由服务层脱敏。</p>
 */
public final class SourcePolicyJson {

    public static final int VERSION = 1;

    private SourcePolicyJson() {
    }

    /** 存储根节点。 */
    public static class Store {

        private Integer version = VERSION;
        private List<Entry> sources = new ArrayList<>();

        public Integer getVersion() {
            return version;
        }

        public void setVersion(Integer version) {
            this.version = version;
        }

        public List<Entry> getSources() {
            return sources;
        }

        public void setSources(List<Entry> sources) {
            this.sources = sources == null ? new ArrayList<>() : sources;
        }
    }

    /** 单条接入源。scope 按供应商自由定义，凭据支持明文或引用环境变量。 */
    public static class Entry {

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
            this.scope = scope == null ? new LinkedHashMap<>() : scope;
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
    }

    /** 解析存储文本；空白视为空列表，结构损坏时抛参数错误而不是静默清空。 */
    @SuppressWarnings("unchecked")
    public static Store read(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return new Store();
        }
        Map<String, Object> root;
        try {
            // 解析器给的是 JsonObject/JsonArray，嵌套值不摊平的话 instanceof List 恒假，source 会被静默丢光
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(raw));
            if (!(plain instanceof Map)) {
                throw configInvalid();
            }
            root = (Map<String, Object>) plain;
        } catch (KBException e) {
            throw e;
        } catch (RuntimeException e) {
            throw configInvalid();
        }
        if (root == null) {
            return new Store();
        }
        Store store = new Store();
        Object version = root.get("version");
        if (version instanceof Number) {
            store.setVersion(((Number) version).intValue());
        }
        Object rawSources = root.get("sources");
        List<Entry> entries = new ArrayList<>();
        if (rawSources instanceof List) {
            for (Object item : (List<?>) rawSources) {
                if (item instanceof Map) {
                    Entry entry = toEntry((Map<?, ?>) item);
                    if (entry != null) {
                        entries.add(entry);
                    }
                }
            }
        }
        store.setSources(entries);
        return store;
    }

    /** 序列化存储文本。 */
    public static String write(Store store) {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", store == null || store.getVersion() == null ? VERSION : store.getVersion());
        List<Map<String, Object>> sources = new ArrayList<>();
        if (store != null) {
            for (Entry entry : store.getSources()) {
                if (entry != null) {
                    sources.add(toMap(entry));
                }
            }
        }
        root.put("sources", sources);
        try {
            return JsonUtil.toJson(root);
        } catch (RuntimeException e) {
            throw configInvalid();
        }
    }

    private static Entry toEntry(Map<?, ?> raw) {
        Entry entry = new Entry();
        entry.setSourceId(text(raw.get("sourceId")));
        if (entry.getSourceId() == null) {
            return null;
        }
        entry.setCategory(text(raw.get("category")));
        entry.setProvider(text(raw.get("provider")));
        entry.setName(text(raw.get("name")));
        entry.setEnabled(bool(raw.get("enabled")));
        entry.setScope(map(raw.get("scope")));
        entry.setCredentialType(text(raw.get("credentialType")));
        entry.setCredentialUsername(text(raw.get("credentialUsername")));
        entry.setSecret(text(raw.get("secret")));
        entry.setSecretRef(text(raw.get("secretRef")));
        return entry;
    }

    private static Map<String, Object> toMap(Entry entry) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("sourceId", entry.getSourceId());
        map.put("category", entry.getCategory());
        map.put("provider", entry.getProvider());
        map.put("name", entry.getName());
        map.put("enabled", entry.getEnabled());
        map.put("scope", entry.getScope() == null ? new LinkedHashMap<>() : entry.getScope());
        map.put("credentialType", entry.getCredentialType());
        map.put("credentialUsername", entry.getCredentialUsername());
        map.put("secret", entry.getSecret());
        map.put("secretRef", entry.getSecretRef());
        return map;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object raw) {
        if (raw instanceof Map) {
            return new LinkedHashMap<>((Map<String, Object>) raw);
        }
        return new LinkedHashMap<>();
    }

    private static String text(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        return text.isEmpty() ? null : text;
    }

    private static Boolean bool(Object raw) {
        if (raw instanceof Boolean) {
            return (Boolean) raw;
        }
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        if (text.isEmpty()) {
            return null;
        }
        return Boolean.parseBoolean(text);
    }

    private static KBException configInvalid() {
        return new KBException("KB_SOURCE_CONFIG_INVALID", "接入源配置格式不合法");
    }
}
