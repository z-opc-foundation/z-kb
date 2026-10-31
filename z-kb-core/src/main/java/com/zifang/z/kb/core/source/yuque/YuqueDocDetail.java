package com.zifang.z.kb.core.source.yuque;

/** 语雀文档详情：body 为 markdown 或表格类 JSON 串。 */
public class YuqueDocDetail {

    private final String docId;
    private final String slug;
    private final String title;
    private final String bookId;
    private final String contentUpdatedAt;
    private final String body;

    public YuqueDocDetail(String docId, String slug, String title, String bookId,
            String contentUpdatedAt, String body) {
        this.docId = docId;
        this.slug = slug;
        this.title = title;
        this.bookId = bookId;
        this.contentUpdatedAt = contentUpdatedAt;
        this.body = body;
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

    public String getBookId() {
        return bookId;
    }

    public String getContentUpdatedAt() {
        return contentUpdatedAt;
    }

    public String getBody() {
        return body;
    }
}
