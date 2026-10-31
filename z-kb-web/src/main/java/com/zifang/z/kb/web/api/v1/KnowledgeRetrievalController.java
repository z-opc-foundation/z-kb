package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.***REMOVED***.api.retrieval.RetrievalResultView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.RetrievalQueryRequest;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
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
@RequestMapping("/api/***REMOVED***/v1/knowledgeBase")
public class KnowledgeRetrievalController {

    private final KnowledgeRetrievalService retrievalService;
    private final ***REMOVED***CallerResolver callerResolver;

    public KnowledgeRetrievalController(KnowledgeRetrievalService retrievalService,
                                        ***REMOVED***CallerResolver callerResolver) {
        this.retrievalService = retrievalService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "库内向量检索", description = "范围固定当前库，dense 模式；返回分数、召回解释与章节上下文")
    @PostMapping("/retrieve")
    public ***REMOVED***Result<RetrievalResultView> retrieve(@RequestBody RetrievalQueryRequest body,
                                                  HttpServletRequest request) {
        return ***REMOVED***Result.ok(retrievalService.retrieve(body.toParam(),
                callerResolver.resolve(request)));
    }
}
