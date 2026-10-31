package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseEffective;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMember;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberCandidate;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MemberGrantRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MemberRevokeRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 知识库成员与权限 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库-成员")
@RestController
@RequestMapping("/api/***REMOVED***/v1/knowledgeBase/member")
public class KnowledgeBaseMemberController {

    private final KnowledgeBaseMemberAdminService memberService;
    private final ***REMOVED***CallerResolver callerResolver;

    public KnowledgeBaseMemberController(KnowledgeBaseMemberAdminService memberService,
                                         ***REMOVED***CallerResolver callerResolver) {
        this.memberService = memberService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "成员列表")
    @GetMapping("/list")
    public ***REMOVED***Result<List<KnowledgeBaseMember>> list(@RequestParam String ***REMOVED***Id,
                                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(memberService.listMembers(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "可授权成员候选")
    @GetMapping("/candidates")
    public ***REMOVED***Result<List<KnowledgeBaseMemberCandidate>> candidates(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(memberService.searchCandidates(***REMOVED***Id, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "授予/变更成员角色")
    @PostMapping("/grant")
    public ***REMOVED***Result<KnowledgeBaseMember> grant(@RequestBody MemberGrantRequest body,
                                               HttpServletRequest request) {
        return ***REMOVED***Result.ok(memberService.grant(body.get***REMOVED***Id(), body.getPrincipalId(),
                body.getRole(), callerResolver.resolve(request)));
    }

    @Operation(summary = "移除成员")
    @PostMapping("/revoke")
    public ***REMOVED***Result<Boolean> revoke(@RequestBody MemberRevokeRequest body,
                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(memberService.revoke(body.get***REMOVED***Id(), body.getPrincipalId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "当前调用者在该库的有效权限")
    @GetMapping("/effective")
    public ***REMOVED***Result<KnowledgeBaseEffective> effective(@RequestParam String ***REMOVED***Id,
                                                      HttpServletRequest request) {
        return ***REMOVED***Result.ok(memberService.effective(***REMOVED***Id, callerResolver.resolve(request)));
    }
}
