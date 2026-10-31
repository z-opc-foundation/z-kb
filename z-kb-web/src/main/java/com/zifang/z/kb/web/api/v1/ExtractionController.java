package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.extraction.ExtractionMaterialView;
import com.zifang.z.***REMOVED***.api.extraction.ExtractionService;
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
 * 本地规则萃取 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "本地规则萃取")
@RestController
@RequestMapping("/api/***REMOVED***/v1/extraction")
public class ExtractionController {

    private final ExtractionService extractionService;
    private final ***REMOVED***CallerResolver callerResolver;

    public ExtractionController(ExtractionService extractionService,
                                ***REMOVED***CallerResolver callerResolver) {
        this.extractionService = extractionService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按物料查询萃取产物",
            description = "摘要/问句/术语/FAQ 与图谱计数均来自本地规则，不调用 LLM")
    @GetMapping("/queryByMaterial")
    public ***REMOVED***Result<ExtractionMaterialView> queryByMaterial(@RequestParam String materialId,
                                                            HttpServletRequest request) {
        return ***REMOVED***Result.ok(extractionService.queryByMaterial(materialId,
                callerResolver.resolve(request)));
    }
}
