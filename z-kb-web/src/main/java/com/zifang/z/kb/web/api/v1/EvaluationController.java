package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.evaluation.DatasetSummaryInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseListInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseUpdateParam;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageInfo;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageParam;
import com.zifang.z.kb.api.evaluation.EvalDatasetPublishParam;
import com.zifang.z.kb.api.evaluation.EvalDatasetSaveParam;
import com.zifang.z.kb.api.evaluation.EvalRunCreateParam;
import com.zifang.z.kb.api.evaluation.EvalRunQueryInfo;
import com.zifang.z.kb.api.evaluation.EvaluationDatasetInfo;
import com.zifang.z.kb.api.evaluation.EvaluationKbPageInfo;
import com.zifang.z.kb.api.evaluation.EvaluationOverviewInfo;
import com.zifang.z.kb.api.evaluation.EvaluationService;
import com.zifang.z.kb.api.evaluation.RunSummaryInfo;
import com.zifang.z.kb.api.evaluation.TrustEvidenceInfo;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 知识评测 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识评测")
@RestController
@RequestMapping("/api/kb/v1/evaluation")
public class EvaluationController {

    private final EvaluationService evaluationService;
    private final KbCallerResolver callerResolver;

    public EvaluationController(EvaluationService evaluationService,
            KbCallerResolver callerResolver) {
        this.evaluationService = evaluationService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "评测口径的库列表",
            description = "按当前租户与可见性过滤；未配置 QA 或未跑批的库不补造指标")
    @GetMapping("/pageKnowledgeBase")
    public KbResult<EvaluationKbPageInfo> pageKnowledgeBase(
            @RequestParam(required = false, defaultValue = "1") int current,
            @RequestParam(required = false, defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.pageKnowledgeBase(current, size, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "单库评测概览")
    @GetMapping("/queryOverview")
    public KbResult<EvaluationOverviewInfo> queryOverview(@RequestParam String kbId,
            @RequestParam(required = false) String baselineRunId,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.queryOverview(kbId, baselineRunId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "查询 QA 集合与题目")
    @GetMapping("/queryDataset")
    public KbResult<EvaluationDatasetInfo> queryDataset(@RequestParam String kbId,
            @RequestParam(required = false) Integer versionNo,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.queryDataset(kbId, versionNo,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "保存 QA 集合草稿", description = "一库一份；已冻结版本需另存新版本")
    @PostMapping("/saveDatasetDraft")
    public KbResult<DatasetSummaryInfo> saveDatasetDraft(@RequestBody EvalDatasetSaveParam body,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.saveDatasetDraft(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "冻结 QA 集合版本")
    @PostMapping("/publishDataset")
    public KbResult<DatasetSummaryInfo> publishDataset(@RequestBody EvalDatasetPublishParam body,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.publishDataset(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "发起跑批",
            description = "同步本地确定性跑批；固定数据集、配置、Judge、快照与索引代际，两小时内同口径自动复用")
    @PostMapping("/createRun")
    public KbResult<RunSummaryInfo> createRun(@RequestBody EvalRunCreateParam body,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.createRun(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "查询跑批详情、四层指标与阶段诊断")
    @GetMapping("/queryRun")
    public KbResult<EvalRunQueryInfo> queryRun(@RequestParam String runId,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.queryRun(runId, callerResolver.resolve(request)));
    }

    @Operation(summary = "逐题结果", description = "可按阶段或仅坏例筛选")
    @PostMapping("/pageCaseResults")
    public KbResult<EvalCaseResultPageInfo> pageCaseResults(
            @RequestBody EvalCaseResultPageParam body, HttpServletRequest request) {
        return KbResult.ok(evaluationService.pageCaseResults(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "坏例台账", description = "按状态与阶段筛选；只归因，不改产物")
    @GetMapping("/listBadcases")
    public KbResult<EvalBadcaseListInfo> listBadcases(@RequestParam String kbId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stageCode,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.listBadcases(kbId, status, stageCode,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "凭什么可用",
            description = "版本、覆盖、评分、逐题、复现五类证据；未录入的明确待补")
    @GetMapping("/queryTrustEvidence")
    public KbResult<Map<String, List<TrustEvidenceInfo>>> queryTrustEvidence(
            @RequestParam String runId, HttpServletRequest request) {
        Map<String, List<TrustEvidenceInfo>> body = new LinkedHashMap<>();
        body.put("items", evaluationService.queryTrustEvidence(runId,
                callerResolver.resolve(request)));
        return KbResult.ok(body);
    }

    @Operation(summary = "坏例状态流转",
            description = "OPEN/FIXING → FIXED；再次出现时自动转 REGRESSED")
    @PostMapping("/updateBadcase")
    public KbResult<EvalBadcaseInfo> updateBadcase(@RequestBody EvalBadcaseUpdateParam body,
            HttpServletRequest request) {
        return KbResult.ok(evaluationService.updateBadcase(body,
                callerResolver.resolve(request)));
    }
}
