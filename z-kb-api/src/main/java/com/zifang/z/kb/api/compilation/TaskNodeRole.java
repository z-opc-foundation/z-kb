package com.zifang.z.kb.api.compilation;

/**
 * 编译任务节点角色。CONTAINER 承载文件，STEP 实际执行阶段，MERGE 作同级屏障。
 */
public enum TaskNodeRole {
    CONTAINER,
    STEP,
    MERGE
}
