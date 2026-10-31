package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigService;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.TaskConfigPublishRequest;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 租户级任务配置 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "任务配置")
@RestController
@RequestMapping("/api/***REMOVED***/v1/taskConfig")
public class TaskConfigController {

    private final TaskConfigService taskConfigService;
    private final ***REMOVED***CallerResolver callerResolver;

    public TaskConfigController(TaskConfigService taskConfigService,
                                ***REMOVED***CallerResolver callerResolver) {
        this.taskConfigService = taskConfigService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "读取当前任务配置", description = "首次访问落系统预置版本 2026.10，返回全部任务性质")
    @GetMapping("/query")
    public ***REMOVED***Result<TaskConfigPanelView> query(HttpServletRequest request) {
        return ***REMOVED***Result.ok(taskConfigService.query(callerResolver.resolve(request)));
    }

    @Operation(summary = "发布任务配置新版本", description = "整版发布全部任务性质，只影响之后创建的任务")
    @PostMapping("/publish")
    public ***REMOVED***Result<TaskConfigPanelView> publish(@RequestBody TaskConfigPublishRequest body,
                                                 HttpServletRequest request) {
        return ***REMOVED***Result.ok(taskConfigService.publish(body.toParam(),
                callerResolver.resolve(request)));
    }
}
