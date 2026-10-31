package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.overview.OverviewService;
import com.zifang.z.***REMOVED***.api.overview.OverviewView;
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
 * 知识库概览 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库概览")
@RestController
@RequestMapping("/api/***REMOVED***/v1/overview")
public class OverviewController {

    private final OverviewService overviewService;
    private final ***REMOVED***CallerResolver callerResolver;

    public OverviewController(OverviewService overviewService, ***REMOVED***CallerResolver callerResolver) {
        this.overviewService = overviewService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "知识库概览统计", description = "只读聚合；未接入领域按 0 返回并标注口径")
    @GetMapping("/***REMOVED***Stats")
    public ***REMOVED***Result<OverviewView> ***REMOVED***Stats(@RequestParam String ***REMOVED***Id,
                                          HttpServletRequest request) {
        return ***REMOVED***Result.ok(overviewService.***REMOVED***Stats(***REMOVED***Id, callerResolver.resolve(request)));
    }
}
