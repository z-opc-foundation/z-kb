package com.zifang.z.kb.api.source;

/**
 * 探测单条接入源连通性；sourceId 有值且未带凭据时读取已保存的凭据。
 */
public class KnowledgeBaseSourceTestParam {

    private String kbId;
    private KnowledgeBaseSourceParam source;

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
}
