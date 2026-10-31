package com.zifang.z.***REMOVED***.api.overview;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 知识库概览聚合（只读）：物料、编译、Wiki、任务计数与最近物料。
 */
public interface OverviewService {

    OverviewView ***REMOVED***Stats(String ***REMOVED***Id, ***REMOVED***Caller caller);
}
