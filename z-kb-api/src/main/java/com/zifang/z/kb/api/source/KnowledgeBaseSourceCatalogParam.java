package com.zifang.z.kb.api.source;

/**
 * 加载可选的团队空间与知识库；scope.namespace 有值时同时返回该团队的知识库。
 */
public class KnowledgeBaseSourceCatalogParam {

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
