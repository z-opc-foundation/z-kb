package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.resource.ConfigValidation;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBase;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseConfigView;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseProfileVersion;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseQuery;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import com.zifang.z.***REMOVED***.web.api.v1.dto.KnowledgeBaseActivityRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.KnowledgeBaseIdRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.KnowledgeBaseUpdateRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.PublishConfigRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.SaveConfigDraftRequest;
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
@RequestMapping("/api/***REMOVED***/v1/knowledgeBase")
public class KnowledgeBaseController {

    private final KnowledgeBaseResourceService resourceService;
    private final KnowledgeBaseConfigService configService;
    private final ***REMOVED***CallerResolver callerResolver;

    public KnowledgeBaseController(KnowledgeBaseResourceService resourceService,
                                   KnowledgeBaseConfigService configService,
                                   ***REMOVED***CallerResolver callerResolver) {
        this.resourceService = resourceService;
        this.configService = configService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "分页查询知识库")
    @PostMapping("/page")
    public ***REMOVED***Result<PageResult<KnowledgeBaseView>> page(
            @RequestBody(required = false) KnowledgeBaseQuery query, HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.page(query, callerResolver.resolve(request)));
    }

    @Operation(summary = "查询知识库详情")
    @GetMapping("/queryDetailById")
    public ***REMOVED***Result<KnowledgeBaseView> queryDetailById(@RequestParam String ***REMOVED***Id,
                                                       HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.detail(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "创建知识库")
    @PostMapping("/add")
    public ***REMOVED***Result<KnowledgeBaseView> add(@RequestBody KnowledgeBase body,
                                           HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.create(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "更新知识库信息")
    @PostMapping("/update")
    public ***REMOVED***Result<KnowledgeBaseView> update(@RequestBody KnowledgeBaseUpdateRequest body,
                                              HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.update(body.get***REMOVED***Id(), body.getName(),
                body.getDescription(), callerResolver.resolve(request)));
    }

    @Operation(summary = "归档知识库")
    @PostMapping("/archive")
    public ***REMOVED***Result<Boolean> archive(@RequestBody KnowledgeBaseIdRequest body,
                                     HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.archive(body.get***REMOVED***Id(), callerResolver.resolve(request)));
    }

    @Operation(summary = "恢复知识库")
    @PostMapping("/restore")
    public ***REMOVED***Result<Boolean> restore(@RequestBody KnowledgeBaseIdRequest body,
                                     HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.restore(body.get***REMOVED***Id(), callerResolver.resolve(request)));
    }

    @Operation(summary = "删除知识库（仅限已归档）")
    @PostMapping("/remove")
    public ***REMOVED***Result<Boolean> remove(@RequestBody KnowledgeBaseIdRequest body,
                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(resourceService.remove(body.get***REMOVED***Id(), callerResolver.resolve(request)));
    }

    @Operation(summary = "查询配置版本（当前/草稿/历史/差异/影响/校验）")
    @GetMapping("/queryConfig")
    public ***REMOVED***Result<KnowledgeBaseConfigView> queryConfig(@RequestParam String ***REMOVED***Id,
                                                         HttpServletRequest request) {
        return ***REMOVED***Result.ok(configService.query(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "保存配置草稿")
    @PostMapping("/saveConfigDraft")
    public ***REMOVED***Result<KnowledgeBaseProfileVersion> saveConfigDraft(
            @RequestBody SaveConfigDraftRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(configService.saveDraft(body.get***REMOVED***Id(), body.toDraft(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "丢弃配置草稿")
    @PostMapping("/discardConfigDraft")
    public ***REMOVED***Result<Boolean> discardConfigDraft(@RequestBody KnowledgeBaseIdRequest body,
                                                HttpServletRequest request) {
        return ***REMOVED***Result.ok(configService.discardDraft(body.get***REMOVED***Id(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "校验配置草稿")
    @PostMapping("/validateConfigDraft")
    public ***REMOVED***Result<ConfigValidation> validateConfigDraft(@RequestBody KnowledgeBaseIdRequest body,
                                                          HttpServletRequest request) {
        return ***REMOVED***Result.ok(configService.validateDraft(body.get***REMOVED***Id(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "发布配置草稿")
    @PostMapping("/publishConfig")
    public ***REMOVED***Result<KnowledgeBaseProfileVersion> publishConfig(
            @RequestBody PublishConfigRequest body, HttpServletRequest request) {
        boolean confirm = body.getConfirm() != null && body.getConfirm();
        return ***REMOVED***Result.ok(configService.publish(body.get***REMOVED***Id(), body.getRemark(), confirm,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "知识库活跃度（热力图）")
    @PostMapping("/activity")
    public ***REMOVED***Result<Map<String, List<KnowledgeBaseActivityPoint>>> activity(
            @RequestBody KnowledgeBaseActivityRequest body, HttpServletRequest request) {
        int days = body.getDays() == null ? 168 : body.getDays();
        return ***REMOVED***Result.ok(resourceService.heatmap(body.get***REMOVED***Ids(), days,
                callerResolver.resolve(request)));
    }
}
