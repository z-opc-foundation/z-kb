package com.zifang.z.kb.web.api.v1.dto;

import com.zifang.z.kb.api.resource.KnowledgeBaseProfileVersion;

import java.util.LinkedHashMap;

/**
 * 保存配置草稿请求：扁平承载版本字段 + kbId，前端一次提交一屏配置。
 */
public class SaveConfigDraftRequest extends KnowledgeBaseProfileVersion {

    private String kbId;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    /** 草稿模型本体（去掉 kbId 后的纯版本字段视图）。 */
    public KnowledgeBaseProfileVersion toDraft() {
        KnowledgeBaseProfileVersion draft = new KnowledgeBaseProfileVersion();
        draft.setPresetVersion(getPresetVersion());
        draft.setParserPolicy(getParserPolicy() == null ? new LinkedHashMap<>() : getParserPolicy());
        draft.setChunkingPolicy(getChunkingPolicy() == null ? new LinkedHashMap<>() : getChunkingPolicy());
        draft.setExtractionPolicy(getExtractionPolicy() == null ? new LinkedHashMap<>() : getExtractionPolicy());
        draft.setWikiPolicy(getWikiPolicy() == null ? new LinkedHashMap<>() : getWikiPolicy());
        draft.setGraphPolicy(getGraphPolicy() == null ? new LinkedHashMap<>() : getGraphPolicy());
        draft.setReviewPolicy(getReviewPolicy() == null ? new LinkedHashMap<>() : getReviewPolicy());
        draft.setFreshnessPolicy(getFreshnessPolicy() == null ? new LinkedHashMap<>() : getFreshnessPolicy());
        draft.setRetrievalPolicy(getRetrievalPolicy() == null ? new LinkedHashMap<>() : getRetrievalPolicy());
        draft.setSourcePolicy(getSourcePolicy() == null ? new LinkedHashMap<>() : getSourcePolicy());
        draft.setRemark(getRemark());
        return draft;
    }
}
