package com.zifang.z.kb.api.source;

/**
 * 读取某个语雀知识库的文章列表，供勾选同步范围。
 */
public class KnowledgeBaseSourceCatalogDocsParam {

    private String kbId;
    private KnowledgeBaseSourceParam source;
    private String book;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public KnowledgeBaseSourceParam getSource() {
        return source;
    }

    public void setSource(KnowledgeBaseSourceParam source) {
        this.source = source;
    }

    public String getBook() {
        return book;
    }

    public void setBook(String book) {
        this.book = book;
    }
}
