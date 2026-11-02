package com.zifang.z.kb.api.taskmonitor;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 调度任务监控：按知识库分页查看执行件，并返回任务管理角标汇总。
 */
public interface TaskMonitorService {

    TaskMonitorPageView page(String kbId, String taskType, String status, int pageNo,
                             int pageSize, KbCaller caller);

    TaskMonitorSummaryView summary(String kbId, KbCaller caller);
}
