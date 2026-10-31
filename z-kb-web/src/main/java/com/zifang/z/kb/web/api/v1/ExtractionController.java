package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.extraction.ExtractionMaterialView;
import com.zifang.z.kb.api.extraction.ExtractionService;
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
 * 本地规则萃取 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "本地规则萃取")
@RestController
@RequestMapping("/api/kb/v1/extraction")
public class ExtractionController {

    private final ExtractionService extractionService;
    private final KbCallerResolver callerResolver;

    public ExtractionController(ExtractionService extractionService,
                                KbCallerResolver callerResolver) {
        this.extractionService = extractionService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按物料查询萃取产物",
            description = "摘要/问句/术语/FAQ 与图谱计数均来自本地规则，不调用 LLM")
    @GetMapping("/queryByMaterial")
    public KbResult<ExtractionMaterialView> queryByMaterial(@RequestParam String materialId,
                                                            HttpServletRequest request) {
        return KbResult.ok(extractionService.queryByMaterial(materialId,
                callerResolver.resolve(request)));
    }
}
