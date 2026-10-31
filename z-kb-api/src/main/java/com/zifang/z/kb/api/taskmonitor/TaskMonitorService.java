package com.zifang.z.***REMOVED***.api.taskmonitor;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 调度任务监控：按知识库分页查看执行件，并返回任务管理角标汇总。
 */
public interface TaskMonitorService {

    TaskMonitorPageView page(String ***REMOVED***Id, String taskType, String status, int pageNo,
                             int pageSize, ***REMOVED***Caller caller);

    TaskMonitorSummaryView summary(String ***REMOVED***Id, ***REMOVED***Caller caller);
}
