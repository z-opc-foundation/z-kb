package com.zifang.z.kb.core.source.yuque;

/** 语雀文档正文读取结果；markdown 已按格式归一（表格类文档完成转换）。 */
public class YuqueDocContent {

    private final String docId;
    private final String slug;
    private final String title;
    private final String bookId;
    private final String updatedAt;
    private final String markdown;
    private final boolean sheetConverted;

    public YuqueDocContent(String docId, String slug, String title, String bookId,
            String updatedAt, String markdown, boolean sheetConverted) {
        this.docId = docId;
        this.slug = slug;
        this.title = title;
        this.bookId = bookId;
        this.updatedAt = updatedAt;
        this.markdown = markdown;
        this.sheetConverted = sheetConverted;
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

    public String getUpdatedAt() {
        return updatedAt;
    }

    public String getMarkdown() {
        return markdown;
    }

    public boolean isSheetConverted() {
        return sheetConverted;
    }
}
