package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.taskconfig.KbTaskConfigService;
import com.zifang.z.kb.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.api.v1.dto.KbTaskConfigPublishRequest;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识库级任务配置 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库任务配置")
@RestController
@RequestMapping("/api/kb/v1/taskConfig/kb")
public class KbTaskConfigController {

    private final KbTaskConfigService kbTaskConfigService;
    private final KbCallerResolver callerResolver;

    public KbTaskConfigController(KbTaskConfigService kbTaskConfigService,
                                  KbCallerResolver callerResolver) {
        this.kbTaskConfigService = kbTaskConfigService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "读取知识库任务配置", description = "库内未覆盖的任务性质回落租户当前版本")
    @GetMapping("/query")
    public KbResult<TaskConfigPanelView> query(@RequestParam String kbId,
                                               HttpServletRequest request) {
        return KbResult.ok(kbTaskConfigService.query(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "发布知识库任务配置新版本", description = "整版覆盖该库的任务配置，只影响之后创建的任务")
    @PostMapping("/publish")
    public KbResult<TaskConfigPanelView> publish(@RequestBody KbTaskConfigPublishRequest body,
                                                 HttpServletRequest request) {
        return KbResult.ok(kbTaskConfigService.publish(body.getKbId(), body.toParam(),
                callerResolver.resolve(request)));
    }
}
