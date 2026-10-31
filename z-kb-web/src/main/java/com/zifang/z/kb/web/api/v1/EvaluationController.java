package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.evaluation.DatasetSummaryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseListInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseUpdateParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalCaseResultPageInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalCaseResultPageParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetPublishParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetSaveParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalRunCreateParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalRunQueryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationDatasetInfo;
import com.zifang.z.***REMOVED***.api.evaluation.Evaluation***REMOVED***PageInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationOverviewInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationService;
import com.zifang.z.***REMOVED***.api.evaluation.RunSummaryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.TrustEvidenceInfo;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
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
@RequestMapping("/api/***REMOVED***/v1/evaluation")
public class EvaluationController {

    private final EvaluationService evaluationService;
    private final ***REMOVED***CallerResolver callerResolver;

    public EvaluationController(EvaluationService evaluationService,
            ***REMOVED***CallerResolver callerResolver) {
        this.evaluationService = evaluationService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "评测口径的库列表",
            description = "按当前租户与可见性过滤；未配置 QA 或未跑批的库不补造指标")
    @GetMapping("/pageKnowledgeBase")
    public ***REMOVED***Result<Evaluation***REMOVED***PageInfo> pageKnowledgeBase(
            @RequestParam(required = false, defaultValue = "1") int current,
            @RequestParam(required = false, defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.pageKnowledgeBase(current, size, keyword,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "单库评测概览")
    @GetMapping("/queryOverview")
    public ***REMOVED***Result<EvaluationOverviewInfo> queryOverview(@RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String baselineRunId,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.queryOverview(***REMOVED***Id, baselineRunId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "查询 QA 集合与题目")
    @GetMapping("/queryDataset")
    public ***REMOVED***Result<EvaluationDatasetInfo> queryDataset(@RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) Integer versionNo,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.queryDataset(***REMOVED***Id, versionNo,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "保存 QA 集合草稿", description = "一库一份；已冻结版本需另存新版本")
    @PostMapping("/saveDatasetDraft")
    public ***REMOVED***Result<DatasetSummaryInfo> saveDatasetDraft(@RequestBody EvalDatasetSaveParam body,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.saveDatasetDraft(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "冻结 QA 集合版本")
    @PostMapping("/publishDataset")
    public ***REMOVED***Result<DatasetSummaryInfo> publishDataset(@RequestBody EvalDatasetPublishParam body,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.publishDataset(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "发起跑批",
            description = "同步本地确定性跑批；固定数据集、配置、Judge、快照与索引代际，两小时内同口径自动复用")
    @PostMapping("/createRun")
    public ***REMOVED***Result<RunSummaryInfo> createRun(@RequestBody EvalRunCreateParam body,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.createRun(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "查询跑批详情、四层指标与阶段诊断")
    @GetMapping("/queryRun")
    public ***REMOVED***Result<EvalRunQueryInfo> queryRun(@RequestParam String runId,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.queryRun(runId, callerResolver.resolve(request)));
    }

    @Operation(summary = "逐题结果", description = "可按阶段或仅坏例筛选")
    @PostMapping("/pageCaseResults")
    public ***REMOVED***Result<EvalCaseResultPageInfo> pageCaseResults(
            @RequestBody EvalCaseResultPageParam body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.pageCaseResults(body,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "坏例台账", description = "按状态与阶段筛选；只归因，不改产物")
    @GetMapping("/listBadcases")
    public ***REMOVED***Result<EvalBadcaseListInfo> listBadcases(@RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stageCode,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.listBadcases(***REMOVED***Id, status, stageCode,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "凭什么可用",
            description = "版本、覆盖、评分、逐题、复现五类证据；未录入的明确待补")
    @GetMapping("/queryTrustEvidence")
    public ***REMOVED***Result<Map<String, List<TrustEvidenceInfo>>> queryTrustEvidence(
            @RequestParam String runId, HttpServletRequest request) {
        Map<String, List<TrustEvidenceInfo>> body = new LinkedHashMap<>();
        body.put("items", evaluationService.queryTrustEvidence(runId,
                callerResolver.resolve(request)));
        return ***REMOVED***Result.ok(body);
    }

    @Operation(summary = "坏例状态流转",
            description = "OPEN/FIXING → FIXED；再次出现时自动转 REGRESSED")
    @PostMapping("/updateBadcase")
    public ***REMOVED***Result<EvalBadcaseInfo> updateBadcase(@RequestBody EvalBadcaseUpdateParam body,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(evaluationService.updateBadcase(body,
                callerResolver.resolve(request)));
    }
}
