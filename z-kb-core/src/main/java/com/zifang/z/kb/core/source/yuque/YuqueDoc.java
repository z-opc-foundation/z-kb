package com.zifang.z.kb.core.source.yuque;

/** 语雀知识库文档列表项：contentUpdatedAt 用来判断正文是否变化。 */
public class YuqueDoc {

    private final String docId;
    private final String slug;
    private final String title;
    private final String contentUpdatedAt;

    public YuqueDoc(String docId, String slug, String title, String contentUpdatedAt) {
        this.docId = docId;
        this.slug = slug;
        this.title = title;
        this.contentUpdatedAt = contentUpdatedAt;
    }

    public String getDocId() {
        return docId;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getContentUpdatedAt() {
        return contentUpdatedAt;
    }
}
