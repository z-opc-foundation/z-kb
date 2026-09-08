package com.zifang.z.kb.api;

/**
 * 文档状态机：
 * CREATED → PARSING → CHUNKING → EMBEDDING → INDEXED
 * 任意阶段失败 → FAILED
 */
public enum DocumentStatus {
    CREATED,
    PARSING,
    CHUNKING,
    EMBEDDING,
    INDEXED,
    FAILED,
    DELETED
}
