package com.zifang.z.kb.api.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 全量覆盖保存接入源列表；传空列表表示清空。
 */
public class KnowledgeBaseSourceSaveParam {

    private String kbId;
    private List<KnowledgeBaseSourceParam> sources = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public List<KnowledgeBaseSourceParam> getSources() {
        return sources;
    }

    public void setSources(List<KnowledgeBaseSourceParam> sources) {
        this.sources = sources == null ? new ArrayList<>() : sources;
    }
}
