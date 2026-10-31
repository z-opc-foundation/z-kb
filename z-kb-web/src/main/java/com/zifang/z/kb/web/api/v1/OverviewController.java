package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.overview.OverviewService;
import com.zifang.z.kb.api.overview.OverviewView;
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
 * 知识库概览 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库概览")
@RestController
@RequestMapping("/api/kb/v1/overview")
public class OverviewController {

    private final OverviewService overviewService;
    private final KbCallerResolver callerResolver;

    public OverviewController(OverviewService overviewService, KbCallerResolver callerResolver) {
        this.overviewService = overviewService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "知识库概览统计", description = "只读聚合；未接入领域按 0 返回并标注口径")
    @GetMapping("/kbStats")
    public KbResult<OverviewView> kbStats(@RequestParam String kbId,
                                          HttpServletRequest request) {
        return KbResult.ok(overviewService.kbStats(kbId, callerResolver.resolve(request)));
    }
}
