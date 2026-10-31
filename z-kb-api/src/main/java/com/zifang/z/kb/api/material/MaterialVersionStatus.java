package com.zifang.z.kb.api.material;

/**
 * 物料版本状态。版本不可变，内容变化产生新版本，旧版本标记 SUPERSEDED。
 */
public enum MaterialVersionStatus {
    REGISTERED,
    PARSING,
    PARSED,
    FAILED,
    SUPERSEDED
}
