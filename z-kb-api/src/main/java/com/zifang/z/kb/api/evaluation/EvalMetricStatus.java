package com.zifang.z.kb.api.evaluation;

/**
 * 指标达标标注。NOT_CONNECTED 表示本期未接入，不用估算值冒充。
 */
public enum EvalMetricStatus {
    PASS,
    FAIL,
    PARTIAL,
    NOT_APPLICABLE,
    NOT_CONNECTED
}
