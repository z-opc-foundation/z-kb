package com.zifang.z.***REMOVED***.api.source;

/**
 * 加载可选的团队空间与知识库；scope.namespace 有值时同时返回该团队的知识库。
 */
public class KnowledgeBaseSourceCatalogParam {

    private String ***REMOVED***Id;
    private KnowledgeBaseSourceParam source;

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
}
