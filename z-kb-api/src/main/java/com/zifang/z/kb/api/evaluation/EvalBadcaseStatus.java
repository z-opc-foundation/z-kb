package com.zifang.z.kb.api.evaluation;

/**
 * 坏例处置状态。坏例再次出现时 FIXED 转为 REGRESSED。
 */
public enum EvalBadcaseStatus {
    OPEN,
    FIXING,
    FIXED,
    REGRESSED,
    IGNORED
}
