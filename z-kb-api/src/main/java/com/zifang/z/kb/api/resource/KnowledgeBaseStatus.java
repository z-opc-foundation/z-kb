package com.zifang.z.kb.api.resource;

/**
 * 知识库生命周期状态。
 */
public enum KnowledgeBaseStatus {
    /** 正常可用 */
    ACTIVE,
    /** 已归档（只读，可恢复） */
    ARCHIVED,
    /** 删除中（清理派生数据） */
    DELETING
}
