package com.zifang.z.kb.api.source;

/**
 * 接入源供应商，决定连通探测与同步执行方式。
 */
public enum KnowledgeBaseSourceProvider {

    YUQUE(KnowledgeBaseSourceCategory.DOC_PLATFORM),
    GIT(KnowledgeBaseSourceCategory.CODE_REPO),
    OSS(KnowledgeBaseSourceCategory.FILE_SHARE),
    SMB(KnowledgeBaseSourceCategory.FILE_SHARE),
    JDBC(KnowledgeBaseSourceCategory.DATABASE);

    private final KnowledgeBaseSourceCategory category;

    KnowledgeBaseSourceProvider(KnowledgeBaseSourceCategory category) {
        this.category = category;
    }

    public KnowledgeBaseSourceCategory getCategory() {
        return category;
    }

    public static KnowledgeBaseSourceProvider of(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        for (KnowledgeBaseSourceProvider provider : values()) {
            if (provider.name().equalsIgnoreCase(trimmed)) {
                return provider;
            }
        }
        return null;
    }
}
