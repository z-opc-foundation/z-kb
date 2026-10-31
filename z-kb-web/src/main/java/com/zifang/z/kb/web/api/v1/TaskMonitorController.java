package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.taskmonitor.TaskMonitorPageView;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorService;
import com.zifang.z.kb.api.taskmonitor.TaskMonitorSummaryView;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.caller.KbCallerResolver;
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
@RequestMapping("/api/kb/v1/taskMonitor")
public class TaskMonitorController {

    private final TaskMonitorService taskMonitorService;
    private final KbCallerResolver callerResolver;

    public TaskMonitorController(TaskMonitorService taskMonitorService,
                                 KbCallerResolver callerResolver) {
        this.taskMonitorService = taskMonitorService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "调度任务分页", description = "按知识库分页返回调度任务，可按类型与状态过滤")
    @GetMapping("/page")
    public KbResult<TaskMonitorPageView> page(
            @RequestParam String kbId,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "1") int pageNo,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            HttpServletRequest request) {
        return KbResult.ok(taskMonitorService.page(kbId, taskType, status, pageNo, pageSize,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "任务管理角标汇总", description = "一次返回组别、单任务与调度任务总数")
    @GetMapping("/summary")
    public KbResult<TaskMonitorSummaryView> summary(@RequestParam String kbId,
                                                    HttpServletRequest request) {
        return KbResult.ok(taskMonitorService.summary(kbId, callerResolver.resolve(request)));
    }
}
