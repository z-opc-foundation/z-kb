package com.zifang.z.kb.api.compilation;

/**
 * 编译任务节点编码。文件节点承载物料版本，步骤节点按 P0–P4 顺序执行。
 */
public enum CompileTaskCode {
    COMPILE_FILE,
    REGISTER,
    PARSE,
    CHUNK,
    INDEX,
    EXTRACT,
    WIKI,
    MERGE
}
