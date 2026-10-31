package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.audit.AuditLogService;
import com.zifang.z.***REMOVED***.api.audit.AuditLogView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.AuditLogPageRequest;
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
 * 审计日志 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "审计日志")
@RestController
@RequestMapping("/api/***REMOVED***/v1/auditLog")
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final ***REMOVED***CallerResolver callerResolver;

    public AuditLogController(AuditLogService auditLogService, ***REMOVED***CallerResolver callerResolver) {
        this.auditLogService = auditLogService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "审计日志分页列表", description = "按关键词、操作人、结果与时间范围查询当前租户的审计日志")
    @PostMapping("/page")
    public ***REMOVED***Result<PageResult<AuditLogView>> page(
            @RequestBody(required = false) AuditLogPageRequest body,
            HttpServletRequest request) {
        AuditLogPageRequest query = body == null ? new AuditLogPageRequest() : body;
        return ***REMOVED***Result.ok(auditLogService.page(query.toQuery(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "审计日志详情", description = "按主键查询单条审计日志，含出入参报文")
    @GetMapping("/get")
    public ***REMOVED***Result<AuditLogView> get(@RequestParam String id, HttpServletRequest request) {
        return ***REMOVED***Result.ok(auditLogService.get(id, callerResolver.resolve(request)));
    }
}
