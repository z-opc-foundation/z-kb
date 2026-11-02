package com.zifang.z.kb.api.evaluation;

/**
 * QA 集合状态。草稿可覆盖，冻结后不可变，归档只做历史留存。
 */
public enum EvalDatasetStatus {
    DRAFT,
    FROZEN,
    ARCHIVED
}
