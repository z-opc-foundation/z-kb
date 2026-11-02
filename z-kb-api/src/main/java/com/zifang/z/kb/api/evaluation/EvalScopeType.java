package com.zifang.z.kb.api.evaluation;

/**
 * 跑批范围。全链路与单阶段分开，单阶段只更新本段诊断。
 */
public enum EvalScopeType {
    FULL,
    STAGE
}
