package com.zifang.z.kb.api.compilation;

/**
 * 编译阶段运行状态。
 */
public enum TaskRunStatus {
    PENDING,
    READY,
    QUEUED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELED,
    SKIPPED;

    public static boolean isTerminal(String status) {
        return SUCCEEDED.name().equals(status) || FAILED.name().equals(status)
                || CANCELED.name().equals(status) || SKIPPED.name().equals(status);
    }
}
