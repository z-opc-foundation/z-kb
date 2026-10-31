package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.concept.ConceptDetailView;
import com.zifang.z.***REMOVED***.api.concept.ConceptService;
import com.zifang.z.***REMOVED***.api.concept.ConceptView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 概念模型 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "概念模型")
@RestController
@RequestMapping("/api/***REMOVED***/v1/concept")
public class ConceptController {

    private final ConceptService conceptService;
    private final ***REMOVED***CallerResolver callerResolver;

    public ConceptController(ConceptService conceptService, ***REMOVED***CallerResolver callerResolver) {
        this.conceptService = conceptService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按知识库查询概念模型",
            description = "概念由编译萃取涌现，按来源资料数与提及次数倒序，单次上限 200")
    @GetMapping("/listBy***REMOVED***")
    public ***REMOVED***Result<List<ConceptView>> listBy***REMOVED***(@RequestParam String ***REMOVED***Id,
                                                @RequestParam(required = false) String keyword,
                                                HttpServletRequest request) {
        return ***REMOVED***Result.ok(conceptService.listBy***REMOVED***(***REMOVED***Id, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "查询概念详情", description = "返回概念模型与来源资料提及，提及单次上限 100")
    @GetMapping("/queryById")
    public ***REMOVED***Result<ConceptDetailView> queryById(@RequestParam String ***REMOVED***Id,
                                                 @RequestParam String conceptId,
                                                 HttpServletRequest request) {
        return ***REMOVED***Result.ok(conceptService.queryById(***REMOVED***Id, conceptId,
                callerResolver.resolve(request)));
    }
}
