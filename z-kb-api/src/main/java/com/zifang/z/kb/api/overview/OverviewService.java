package com.zifang.z.kb.api.overview;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 知识库概览聚合（只读）：物料、编译、Wiki、任务计数与最近物料。
 */
public interface OverviewService {

    OverviewView kbStats(String kbId, KbCaller caller);
}
