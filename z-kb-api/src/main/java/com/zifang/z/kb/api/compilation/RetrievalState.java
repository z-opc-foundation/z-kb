package com.zifang.z.kb.api.compilation;

/**
 * 产物与检索块的索引状态。
 */
public enum RetrievalState {
    NOT_INDEXED,
    INDEXED,
    STALE,
    REMOVED
}
