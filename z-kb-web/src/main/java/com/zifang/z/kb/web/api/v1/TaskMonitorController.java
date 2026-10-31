package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorPageView;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorSummaryView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 调度任务监控 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "调度任务")
@RestController
@RequestMapping("/api/***REMOVED***/v1/taskMonitor")
public class TaskMonitorController {

    private final TaskMonitorService taskMonitorService;
    private final ***REMOVED***CallerResolver callerResolver;

    public TaskMonitorController(TaskMonitorService taskMonitorService,
                                 ***REMOVED***CallerResolver callerResolver) {
        this.taskMonitorService = taskMonitorService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "调度任务分页", description = "按知识库分页返回调度任务，可按类型与状态过滤")
    @GetMapping("/page")
    public ***REMOVED***Result<TaskMonitorPageView> page(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "1") int pageNo,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(taskMonitorService.page(***REMOVED***Id, taskType, status, pageNo, pageSize,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "任务管理角标汇总", description = "一次返回组别、单任务与调度任务总数")
    @GetMapping("/summary")
    public ***REMOVED***Result<TaskMonitorSummaryView> summary(@RequestParam String ***REMOVED***Id,
                                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(taskMonitorService.summary(***REMOVED***Id, callerResolver.resolve(request)));
    }
}
