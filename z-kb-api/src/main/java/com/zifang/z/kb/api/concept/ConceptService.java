package com.zifang.z.kb.api.concept;

import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * 概念模型查询：概念由编译萃取涌现，按规范化名称归一到知识库级。
 */
public interface ConceptService {

    /** 列出知识库下的概念（单次上限 200），支持名称关键词过滤。 */
    List<ConceptView> listByKb(String kbId, String keyword, KbCaller caller);

    /** 返回概念详情及最近 100 条来源资料提及，概念不存在时抛 KB_CONCEPT_NOT_FOUND。 */
    ConceptDetailView queryById(String kbId, String conceptId, KbCaller caller);
}
