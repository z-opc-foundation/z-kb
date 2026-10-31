package com.zifang.z.kb.api.compilation;

/**
 * 编译作业范围来源。SINGLE 为单文件作业，其余为多文件组别。
 */
public enum BatchScopeType {
    SINGLE,
    WORKSPACE,
    CATEGORY,
    FOLDER,
    NONE
}
