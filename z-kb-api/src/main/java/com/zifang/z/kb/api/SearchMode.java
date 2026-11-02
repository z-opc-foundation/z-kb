package com.zifang.z.kb.api;

/**
 * 检索模式。
 */
public enum SearchMode {
    /** 仅向量检索（语义） */
    VECTOR,
    /** 仅关键词检索（BM25） */
    KEYWORD,
    /** 仅图谱检索（实体 + 多跳） */
    GRAPH,
    /** 向量 + 关键词混合 */
    HYBRID,
    /** 向量 + 关键词 + 图谱 三路召回 + RRF */
    FUSION
}
