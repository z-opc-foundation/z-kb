package com.zifang.z.kb.api.compilation;

/**
 * 编译作业运行状态。
 */
public enum JobRunStatus {
    QUEUED,
    RUNNING,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELED;

    public static boolean isTerminal(String status) {
        return COMPLETED.name().equals(status) || FAILED.name().equals(status)
                || CANCELED.name().equals(status);
    }
}
