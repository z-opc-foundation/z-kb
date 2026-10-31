package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.concept.ConceptDetailView;
import com.zifang.z.kb.api.concept.ConceptService;
import com.zifang.z.kb.api.concept.ConceptView;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.caller.KbCallerResolver;
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
@RequestMapping("/api/kb/v1/concept")
public class ConceptController {

    private final ConceptService conceptService;
    private final KbCallerResolver callerResolver;

    public ConceptController(ConceptService conceptService, KbCallerResolver callerResolver) {
        this.conceptService = conceptService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按知识库查询概念模型",
            description = "概念由编译萃取涌现，按来源资料数与提及次数倒序，单次上限 200")
    @GetMapping("/listByKb")
    public KbResult<List<ConceptView>> listByKb(@RequestParam String kbId,
                                                @RequestParam(required = false) String keyword,
                                                HttpServletRequest request) {
        return KbResult.ok(conceptService.listByKb(kbId, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "查询概念详情", description = "返回概念模型与来源资料提及，提及单次上限 100")
    @GetMapping("/queryById")
    public KbResult<ConceptDetailView> queryById(@RequestParam String kbId,
                                                 @RequestParam String conceptId,
                                                 HttpServletRequest request) {
        return KbResult.ok(conceptService.queryById(kbId, conceptId,
                callerResolver.resolve(request)));
    }
}
