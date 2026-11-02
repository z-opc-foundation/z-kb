package com.zifang.z.kb.api.source;

/**
 * 接入源供应商，决定连通探测与同步执行方式。
 */
public enum KnowledgeBaseSourceProvider {

    YUQUE(KnowledgeBaseSourceCategory.DOC_PLATFORM),
    GIT(KnowledgeBaseSourceCategory.CODE_REPO),
    OSS(KnowledgeBaseSourceCategory.FILE_SHARE),
    SMB(KnowledgeBaseSourceCategory.FILE_SHARE),
    JDBC(KnowledgeBaseSourceCategory.DATABASE),
    /**
     * 本地目录 —— 桌面端笔记工作区可以直接配成接入源。
     *
     * <p>与 OSS/SMB 的区别：这三者都要连远端服务并带凭据，本地目录是本机路径，
     * 不需要任何凭据（{@code credentialType=NONE}）。归到 FILE_SHARE 分类是为了
     * 不给前端加新分类（分类树与列表分组都按 category 走）。
     */
    LOCAL(KnowledgeBaseSourceCategory.FILE_SHARE);

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
