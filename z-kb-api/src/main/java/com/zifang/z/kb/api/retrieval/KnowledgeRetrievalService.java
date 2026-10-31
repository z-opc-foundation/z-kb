package com.zifang.z.***REMOVED***.api.retrieval;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 库内检索。范围固定当前知识库，使用本地确定性向量做 dense 召回。
 */
public interface KnowledgeRetrievalService {

    /** 在知识库内执行 dense 向量检索，返回分数、召回解释与章节上下文。 */
    RetrievalResultView retrieve(RetrievalQueryParam param, ***REMOVED***Caller caller);
}
