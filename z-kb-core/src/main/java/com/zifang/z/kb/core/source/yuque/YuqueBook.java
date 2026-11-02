package com.zifang.z.kb.core.source.yuque;

/** 语雀知识库：namespace 形如 group/book，itemsCount 为该库文档数。 */
public class YuqueBook {

    private final String namespace;
    private final String slug;
    private final String name;
    private final Integer docsCount;
    private final Integer visibility;

    public YuqueBook(String namespace, String slug, String name, Integer docsCount,
            Integer visibility) {
        this.namespace = namespace;
        this.slug = slug;
        this.name = name;
        this.docsCount = docsCount;
        this.visibility = visibility;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }

    public Integer getDocsCount() {
        return docsCount;
    }

    public Integer getVisibility() {
        return visibility;
    }
}
