package com.zifang.z.kb.api.compilation;

/**
 * 产物类型。一件产物登记一行，内容按类型落在各自结构表。
 */
public enum ArtifactType {
    RETRIEVAL_CHUNK,
    SUMMARY,
    QUESTION_SET,
    TERM,
    FAQ,
    GRAPH_BLOCK,
    WIKI_PAGE,
    WIKI_DOC
}
