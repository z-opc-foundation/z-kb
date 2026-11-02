package com.zifang.z.kb.api.evaluation;

/**
 * 四层指标。层与层不做加权总分。
 */
public enum EvalMetricLayer {
    CORE,
    PRECONDITION,
    DIAGNOSTIC,
    RUNTIME
}
