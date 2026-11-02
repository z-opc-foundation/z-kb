package com.zifang.z.kb.api.source;

/**
 * 接入源分类，仅用于列表分组；真正决定连通方式的是供应商。
 */
public enum KnowledgeBaseSourceCategory {

    DOC_PLATFORM("文档平台"),
    CODE_REPO("代码仓库"),
    FILE_SHARE("文件共享"),
    DATABASE("数据库");

    private final String label;

    KnowledgeBaseSourceCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static KnowledgeBaseSourceCategory of(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        for (KnowledgeBaseSourceCategory category : values()) {
            if (category.name().equalsIgnoreCase(trimmed)) {
                return category;
            }
        }
        return null;
    }
}
