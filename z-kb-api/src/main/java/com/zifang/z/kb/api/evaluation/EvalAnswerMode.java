package com.zifang.z.kb.api.evaluation;

/**
 * 评测答案模式。本期只有抽取式与拒答，不调用生成模型。
 */
public enum EvalAnswerMode {
    EXTRACTIVE_TOP3,
    REFUSED
}
