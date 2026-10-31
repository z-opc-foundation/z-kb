package com.zifang.z.***REMOVED***.api.source;

/**
 * 读取某个语雀知识库的文章列表，供勾选同步范围。
 */
public class KnowledgeBaseSourceCatalogDocsParam {

    private String ***REMOVED***Id;
    private KnowledgeBaseSourceParam source;
    private String book;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
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
