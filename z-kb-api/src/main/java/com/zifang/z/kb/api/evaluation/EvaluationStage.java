package com.zifang.z.kb.api.evaluation;

/**
 * 文档 RAG 主链阶段。S1–S8 用于阶段诊断，CORE 与 RUNTIME 只做指标分组，不是可单独跑批的阶段。
 */
public enum EvaluationStage {

    S1("解析"),
    S2("切块"),
    S3("增强"),
    S4("索引"),
    S5("召回"),
    S6("融合与精排"),
    S7("生成与引用"),
    S8("反馈回归"),
    CORE("核心结果"),
    RUNTIME("运行");

    private final String label;

    EvaluationStage(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isRunnable() {
        return ordinal() <= S8.ordinal();
    }

    public static EvaluationStage of(String value) {
        if (value == null) {
            return null;
        }
        for (EvaluationStage stage : values()) {
            if (stage.name().equals(value.trim().toUpperCase(java.util.Locale.ROOT))) {
                return stage;
            }
        }
        return null;
    }
}
