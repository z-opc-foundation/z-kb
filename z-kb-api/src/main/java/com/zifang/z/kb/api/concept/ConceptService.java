package com.zifang.z.***REMOVED***.api.concept;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import java.util.List;

/**
 * 概念模型查询：概念由编译萃取涌现，按规范化名称归一到知识库级。
 */
public interface ConceptService {

    /** 列出知识库下的概念（单次上限 200），支持名称关键词过滤。 */
    List<ConceptView> listBy***REMOVED***(String ***REMOVED***Id, String keyword, ***REMOVED***Caller caller);

    /** 返回概念详情及最近 100 条来源资料提及，概念不存在时抛 ***REMOVED***CONCEPT_NOT_FOUND。 */
    ConceptDetailView queryById(String ***REMOVED***Id, String conceptId, ***REMOVED***Caller caller);
}
