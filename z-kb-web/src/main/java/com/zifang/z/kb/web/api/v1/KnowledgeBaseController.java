package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.resource.ConfigValidation;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigView;
import com.zifang.z.kb.api.resource.KnowledgeBaseProfileVersion;
import com.zifang.z.kb.api.resource.KnowledgeBaseQuery;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.PageResult;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import com.zifang.z.kb.web.api.v1.dto.KnowledgeBaseActivityRequest;
import com.zifang.z.kb.web.api.v1.dto.KnowledgeBaseIdRequest;
import com.zifang.z.kb.web.api.v1.dto.KnowledgeBaseUpdateRequest;
import com.zifang.z.kb.web.api.v1.dto.PublishConfigRequest;
import com.zifang.z.kb.web.api.v1.dto.SaveConfigDraftRequest;
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
import java.util.Map;

/**
 * 知识库资源 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库-资源")
@RestController
@RequestMapping("/api/kb/v1/knowledgeBase")
public class KnowledgeBaseController {

    private final KnowledgeBaseResourceService resourceService;
    private final KnowledgeBaseConfigService configService;
    private final KbCallerResolver callerResolver;

    public KnowledgeBaseController(KnowledgeBaseResourceService resourceService,
                                   KnowledgeBaseConfigService configService,
                                   KbCallerResolver callerResolver) {
        this.resourceService = resourceService;
        this.configService = configService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "分页查询知识库")
    @PostMapping("/page")
    public KbResult<PageResult<KnowledgeBaseView>> page(
            @RequestBody(required = false) KnowledgeBaseQuery query, HttpServletRequest request) {
        return KbResult.ok(resourceService.page(query, callerResolver.resolve(request)));
    }

    @Operation(summary = "查询知识库详情")
    @GetMapping("/queryDetailById")
    public KbResult<KnowledgeBaseView> queryDetailById(@RequestParam String kbId,
                                                       HttpServletRequest request) {
        return KbResult.ok(resourceService.detail(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "创建知识库")
    @PostMapping("/add")
    public KbResult<KnowledgeBaseView> add(@RequestBody KnowledgeBase body,
                                           HttpServletRequest request) {
        return KbResult.ok(resourceService.create(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "更新知识库信息")
    @PostMapping("/update")
    public KbResult<KnowledgeBaseView> update(@RequestBody KnowledgeBaseUpdateRequest body,
                                              HttpServletRequest request) {
        return KbResult.ok(resourceService.update(body.getKbId(), body.getName(),
                body.getDescription(), callerResolver.resolve(request)));
    }

    @Operation(summary = "归档知识库")
    @PostMapping("/archive")
    public KbResult<Boolean> archive(@RequestBody KnowledgeBaseIdRequest body,
                                     HttpServletRequest request) {
        return KbResult.ok(resourceService.archive(body.getKbId(), callerResolver.resolve(request)));
    }

    @Operation(summary = "恢复知识库")
    @PostMapping("/restore")
    public KbResult<Boolean> restore(@RequestBody KnowledgeBaseIdRequest body,
                                     HttpServletRequest request) {
        return KbResult.ok(resourceService.restore(body.getKbId(), callerResolver.resolve(request)));
    }

    @Operation(summary = "删除知识库（仅限已归档）")
    @PostMapping("/remove")
    public KbResult<Boolean> remove(@RequestBody KnowledgeBaseIdRequest body,
                                    HttpServletRequest request) {
        return KbResult.ok(resourceService.remove(body.getKbId(), callerResolver.resolve(request)));
    }

    @Operation(summary = "查询配置版本（当前/草稿/历史/差异/影响/校验）")
    @GetMapping("/queryConfig")
    public KbResult<KnowledgeBaseConfigView> queryConfig(@RequestParam String kbId,
                                                         HttpServletRequest request) {
        return KbResult.ok(configService.query(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "保存配置草稿")
    @PostMapping("/saveConfigDraft")
    public KbResult<KnowledgeBaseProfileVersion> saveConfigDraft(
            @RequestBody SaveConfigDraftRequest body, HttpServletRequest request) {
        return KbResult.ok(configService.saveDraft(body.getKbId(), body.toDraft(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "丢弃配置草稿")
    @PostMapping("/discardConfigDraft")
    public KbResult<Boolean> discardConfigDraft(@RequestBody KnowledgeBaseIdRequest body,
                                                HttpServletRequest request) {
        return KbResult.ok(configService.discardDraft(body.getKbId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "校验配置草稿")
    @PostMapping("/validateConfigDraft")
    public KbResult<ConfigValidation> validateConfigDraft(@RequestBody KnowledgeBaseIdRequest body,
                                                          HttpServletRequest request) {
        return KbResult.ok(configService.validateDraft(body.getKbId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "发布配置草稿")
    @PostMapping("/publishConfig")
    public KbResult<KnowledgeBaseProfileVersion> publishConfig(
            @RequestBody PublishConfigRequest body, HttpServletRequest request) {
        boolean confirm = body.getConfirm() != null && body.getConfirm();
        return KbResult.ok(configService.publish(body.getKbId(), body.getRemark(), confirm,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "知识库活跃度（热力图）")
    @PostMapping("/activity")
    public KbResult<Map<String, List<KnowledgeBaseActivityPoint>>> activity(
            @RequestBody KnowledgeBaseActivityRequest body, HttpServletRequest request) {
        int days = body.getDays() == null ? 168 : body.getDays();
        return KbResult.ok(resourceService.heatmap(body.getKbIds(), days,
                callerResolver.resolve(request)));
    }
}
