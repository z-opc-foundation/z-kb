package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.wiki.WikiAgentSaveParam;
import com.zifang.z.kb.api.wiki.WikiCompileParam;
import com.zifang.z.kb.api.wiki.WikiCompileTaskView;
import com.zifang.z.kb.api.wiki.WikiGenerateResultView;
import com.zifang.z.kb.api.wiki.WikiGeneratedDocView;
import com.zifang.z.kb.api.wiki.WikiLineageView;
import com.zifang.z.kb.api.wiki.WikiPageDetailView;
import com.zifang.z.kb.api.wiki.WikiPageView;
import com.zifang.z.kb.api.wiki.WikiService;
import com.zifang.z.kb.protocol.response.KbResult;
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

import java.util.ArrayList;
import java.util.List;

/**
 * Wiki 产物 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "Wiki 产物")
@RestController
@RequestMapping("/api/kb/v1/wiki")
public class WikiController {

    private final WikiService wikiService;
    private final KbCallerResolver callerResolver;

    public WikiController(WikiService wikiService, KbCallerResolver callerResolver) {
        this.wikiService = wikiService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "生成 Wiki",
            description = "按已解析正文确定性生成页面，单条失败不阻断其他资料")
    @PostMapping("/generate")
    public KbResult<WikiGenerateResultView> generate(@RequestBody GenerateRequest body,
                                                     HttpServletRequest request) {
        return KbResult.ok(wikiService.generate(body.getKbId(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "按库列出 Wiki", description = "标题与摘要关键词过滤，返回条数默认 50、上限 100")
    @GetMapping("/list")
    public KbResult<List<WikiPageView>> list(@RequestParam String kbId,
                                             @RequestParam(required = false) String keyword,
                                             @RequestParam(required = false, defaultValue = "50")
                                             int limit,
                                             HttpServletRequest request) {
        return KbResult.ok(wikiService.list(kbId, keyword, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "Wiki 详情", description = "返回要点正文、来源资料与本地规则图谱计数")
    @GetMapping("/detail")
    public KbResult<WikiPageDetailView> detail(@RequestParam String wikiId,
                                               HttpServletRequest request) {
        return KbResult.ok(wikiService.detail(wikiId, callerResolver.resolve(request)));
    }

    @Operation(summary = "按资料列出 Wiki", description = "未生成时返回空列表")
    @GetMapping("/listByMaterial")
    public KbResult<List<WikiPageView>> listByMaterial(@RequestParam String materialId,
                                                       HttpServletRequest request) {
        return KbResult.ok(wikiService.listByMaterial(materialId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "Wiki 血缘", description = "传入 wikiId 查看单页血缘，只传 kbId 查看库级血缘")
    @GetMapping("/lineage")
    public KbResult<WikiLineageView> lineage(@RequestParam(required = false) String kbId,
                                             @RequestParam(required = false) String wikiId,
                                             HttpServletRequest request) {
        return KbResult.ok(wikiService.lineage(kbId, wikiId, callerResolver.resolve(request)));
    }

    @Operation(summary = "写入 Agent 编译产物", description = "按页面标识幂等写入多页，刷新目录与块覆盖")
    @PostMapping("/saveGenerated")
    public KbResult<WikiGeneratedDocView> saveGenerated(@RequestBody WikiAgentSaveParam body,
                                                        HttpServletRequest request) {
        return KbResult.ok(wikiService.saveGenerated(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "查询 Agent 编译产物", description = "按物料返回最近一次目录与页面集合，未编译过返回空")
    @GetMapping("/queryGenerated")
    public KbResult<WikiGeneratedDocView> queryGenerated(@RequestParam String materialId,
                                                         HttpServletRequest request) {
        return KbResult.ok(wikiService.queryGenerated(materialId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "提交 Wiki 编译任务",
            description = "z-kb 无独立任务内核，请求内同步生成规则页面并返回终态")
    @PostMapping("/compile")
    public KbResult<WikiCompileTaskView> compile(@RequestBody WikiCompileParam body,
                                                 HttpServletRequest request) {
        return KbResult.ok(wikiService.compile(body, callerResolver.resolve(request)));
    }

    /** 批量生成请求：知识库 + 物料集合。 */
    public static class GenerateRequest {

        private String kbId;
        private List<String> materialIds = new ArrayList<>();

        public String getKbId() {
            return kbId;
        }

        public void setKbId(String kbId) {
            this.kbId = kbId;
        }

        public List<String> getMaterialIds() {
            return materialIds;
        }

        public void setMaterialIds(List<String> materialIds) {
            this.materialIds = materialIds == null ? new ArrayList<>() : materialIds;
        }
    }
}
