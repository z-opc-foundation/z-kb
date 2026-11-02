package com.zifang.z.kb.api.resource;

/**
 * 知识库成员角色（库级 RBAC）。
 */
public enum KnowledgeBaseRole {
    /** 库管理员：全量动作 */
    KB_ADMIN,
    /** 编辑：去管理动作 */
    EDITOR,
    /** 贡献者：只写资料 */
    CONTRIBUTOR,
    /** 评审：只评审 */
    REVIEWER,
    /** 只读 */
    READER
}
