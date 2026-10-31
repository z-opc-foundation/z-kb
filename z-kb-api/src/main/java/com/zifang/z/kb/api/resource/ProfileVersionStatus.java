package com.zifang.z.kb.api.resource;

/**
 * 知识库配置版本状态。
 */
public enum ProfileVersionStatus {
    /** 草稿（可多次覆盖保存） */
    DRAFT,
    /** 当前生效 */
    CURRENT,
    /** 历史版本 */
    SUPERSEDED
}
