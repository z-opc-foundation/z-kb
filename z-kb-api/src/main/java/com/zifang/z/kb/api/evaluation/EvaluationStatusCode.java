package com.zifang.z.kb.api.evaluation;

/**
 * 知识评测域错误码。枚举名即 {@code KBException} 的错误码，web 层据此映射 HTTP 状态。
 */
public enum EvaluationStatusCode {

    EVAL_PARAM_INVALID("评测参数不合法"),
    EVAL_DATASET_NOT_FOUND("评测数据集不存在"),
    EVAL_DATASET_STATUS_INVALID("评测数据集状态不允许该操作"),
    EVAL_DATASET_VERSION_MISMATCH("评测数据集版本不匹配"),
    EVAL_DATASET_EMPTY("评测数据集没有可用题目"),
    EVAL_DATASET_TOO_MANY("评测数据集题目超过上限"),
    EVAL_RUN_NOT_FOUND("评测跑批不存在"),
    EVAL_RUN_BUSY("当前知识库有排队或运行中的任务"),
    EVAL_SNAPSHOT_EMPTY("知识库内容快照为空"),
    EVAL_SNAPSHOT_BUILD_FAILED("知识库内容快照构建失败"),
    EVAL_BADCASE_NOT_FOUND("坏例不存在"),
    EVAL_BADCASE_STATUS_INVALID("坏例状态不合法"),
    EVAL_RUN_NOT_REUSABLE("评测跑批不可复用"),
    EVAL_STAGE_INVALID("评测阶段不合法");

    private final String message;

    EvaluationStatusCode(String message) {
        this.message = message;
    }

    public String code() {
        return name();
    }

    public String message() {
        return message;
    }
}
