package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.resource.KnowledgeBaseEffective;
import com.zifang.z.kb.api.resource.KnowledgeBaseMember;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberCandidate;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import com.zifang.z.kb.web.api.v1.dto.MemberGrantRequest;
import com.zifang.z.kb.web.api.v1.dto.MemberRevokeRequest;
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
@RequestMapping("/api/kb/v1/knowledgeBase/member")
public class KnowledgeBaseMemberController {

    private final KnowledgeBaseMemberAdminService memberService;
    private final KbCallerResolver callerResolver;

    public KnowledgeBaseMemberController(KnowledgeBaseMemberAdminService memberService,
                                         KbCallerResolver callerResolver) {
        this.memberService = memberService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "成员列表")
    @GetMapping("/list")
    public KbResult<List<KnowledgeBaseMember>> list(@RequestParam String kbId,
                                                    HttpServletRequest request) {
        return KbResult.ok(memberService.listMembers(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "可授权成员候选")
    @GetMapping("/candidates")
    public KbResult<List<KnowledgeBaseMemberCandidate>> candidates(
            @RequestParam String kbId,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        return KbResult.ok(memberService.searchCandidates(kbId, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "授予/变更成员角色")
    @PostMapping("/grant")
    public KbResult<KnowledgeBaseMember> grant(@RequestBody MemberGrantRequest body,
                                               HttpServletRequest request) {
        return KbResult.ok(memberService.grant(body.getKbId(), body.getPrincipalId(),
                body.getRole(), callerResolver.resolve(request)));
    }

    @Operation(summary = "移除成员")
    @PostMapping("/revoke")
    public KbResult<Boolean> revoke(@RequestBody MemberRevokeRequest body,
                                    HttpServletRequest request) {
        return KbResult.ok(memberService.revoke(body.getKbId(), body.getPrincipalId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "当前调用者在该库的有效权限")
    @GetMapping("/effective")
    public KbResult<KnowledgeBaseEffective> effective(@RequestParam String kbId,
                                                      HttpServletRequest request) {
        return KbResult.ok(memberService.effective(kbId, callerResolver.resolve(request)));
    }
}
