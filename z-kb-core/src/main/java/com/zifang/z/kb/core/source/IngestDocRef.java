package com.zifang.z.kb.core.source;

/**
 * 目录树里的一个可同步文档节点。
 */
public class IngestDocRef {

    private final String slug;
    private final String title;
    private final String docId;
    private final String path;
    private final int level;
    private final String bookScope;
    private final String categoryId;

    public IngestDocRef(String slug, String title, String docId, String path, int level) {
        this(slug, title, docId, path, level, null, null);
    }

    public IngestDocRef(String slug, String title, String docId, String path, int level,
            String bookScope, String categoryId) {
        this.slug = slug;
        this.title = title;
        this.docId = docId;
        this.path = path;
        this.level = level;
        this.bookScope = bookScope;
        this.categoryId = categoryId;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getDocId() {
        return docId;
    }

    public String getPath() {
        return path;
    }

    public int getLevel() {
        return level;
    }

    public String getBookScope() {
        return bookScope;
    }

    public String getCategoryId() {
        return categoryId;
    }
}
