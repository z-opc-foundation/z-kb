package com.zifang.z.***REMOVED***.web.api.v1.dto;

import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseProfileVersion;

import java.util.LinkedHashMap;

/**
 * 保存配置草稿请求：扁平承载版本字段 + ***REMOVED***Id，前端一次提交一屏配置。
 */
public class SaveConfigDraftRequest extends KnowledgeBaseProfileVersion {

    private String ***REMOVED***Id;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    /** 草稿模型本体（去掉 ***REMOVED***Id 后的纯版本字段视图）。 */
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
