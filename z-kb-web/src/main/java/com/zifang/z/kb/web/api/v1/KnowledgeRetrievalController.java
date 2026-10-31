package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.retrieval.RetrievalResultView;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.api.v1.dto.RetrievalQueryRequest;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识检索 REST API（路径与语义对齐参考实现 {@code /v1/knowledgeBase/retrieve}）。
 */
@Tag(name = "知识检索")
@RestController
@RequestMapping("/api/kb/v1/knowledgeBase")
public class KnowledgeRetrievalController {

    private final KnowledgeRetrievalService retrievalService;
    private final KbCallerResolver callerResolver;

    public KnowledgeRetrievalController(KnowledgeRetrievalService retrievalService,
                                        KbCallerResolver callerResolver) {
        this.retrievalService = retrievalService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "库内向量检索", description = "范围固定当前库，dense 模式；返回分数、召回解释与章节上下文")
    @PostMapping("/retrieve")
    public KbResult<RetrievalResultView> retrieve(@RequestBody RetrievalQueryRequest body,
                                                  HttpServletRequest request) {
        return KbResult.ok(retrievalService.retrieve(body.toParam(),
                callerResolver.resolve(request)));
    }
}
