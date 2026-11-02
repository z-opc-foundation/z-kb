package com.zifang.z.kb.api.compilation;

/**
 * 编译组别运行状态。组别只聚合成员结果，不承载阶段与产物。
 */
public enum BatchStatus {
    RUNNING,
    COMPLETED,
    PARTIAL,
    FAILED,
    CANCELED
}
