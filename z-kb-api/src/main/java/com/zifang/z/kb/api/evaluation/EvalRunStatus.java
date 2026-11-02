package com.zifang.z.kb.api.evaluation;

/**
 * 评测跑批状态。完成后再以 resultUsable 区分结果可用与不可用。
 */
public enum EvalRunStatus {
    QUEUED,
    RUNNING,
    SUCCEEDED,
    FAILED
}
