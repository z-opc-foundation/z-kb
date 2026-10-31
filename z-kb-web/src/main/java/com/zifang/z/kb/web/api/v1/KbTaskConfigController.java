package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.taskconfig.***REMOVED***TaskConfigService;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.***REMOVED***TaskConfigPublishRequest;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识库级任务配置 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库任务配置")
@RestController
@RequestMapping("/api/***REMOVED***/v1/taskConfig/***REMOVED***")
public class ***REMOVED***TaskConfigController {

    private final ***REMOVED***TaskConfigService ***REMOVED***TaskConfigService;
    private final ***REMOVED***CallerResolver callerResolver;

    public ***REMOVED***TaskConfigController(***REMOVED***TaskConfigService ***REMOVED***TaskConfigService,
                                  ***REMOVED***CallerResolver callerResolver) {
        this.***REMOVED***TaskConfigService = ***REMOVED***TaskConfigService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "读取知识库任务配置", description = "库内未覆盖的任务性质回落租户当前版本")
    @GetMapping("/query")
    public ***REMOVED***Result<TaskConfigPanelView> query(@RequestParam String ***REMOVED***Id,
                                               HttpServletRequest request) {
        return ***REMOVED***Result.ok(***REMOVED***TaskConfigService.query(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "发布知识库任务配置新版本", description = "整版覆盖该库的任务配置，只影响之后创建的任务")
    @PostMapping("/publish")
    public ***REMOVED***Result<TaskConfigPanelView> publish(@RequestBody ***REMOVED***TaskConfigPublishRequest body,
                                                 HttpServletRequest request) {
        return ***REMOVED***Result.ok(***REMOVED***TaskConfigService.publish(body.get***REMOVED***Id(), body.toParam(),
                callerResolver.resolve(request)));
    }
}
