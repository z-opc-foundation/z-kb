package com.zifang.z.***REMOVED***.api.source;

/**
 * 探测单条接入源连通性；sourceId 有值且未带凭据时读取已保存的凭据。
 */
public class KnowledgeBaseSourceTestParam {

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
