package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.compilation.CompilationBatchPageView;
import com.zifang.z.***REMOVED***.api.compilation.CompilationBatchService;
import com.zifang.z.***REMOVED***.api.compilation.CompilationBatchView;
import com.zifang.z.***REMOVED***.api.compilation.CompilationJobView;
import com.zifang.z.***REMOVED***.api.compilation.CompilationService;
import com.zifang.z.***REMOVED***.api.compilation.RetrievalChunkView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CompilationBatchCancelRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CompilationBatchCreateRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CompilationCancelRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CompilationRetryRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CompilationRunRequest;
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

import java.util.List;

/**
 * 编译域 REST API（路径与语义对齐参考实现 {@code /v1/compilation}）。
 */
@Tag(name = "编译任务")
@RestController
@RequestMapping("/api/***REMOVED***/v1/compilation")
public class CompilationController {

    private final CompilationService compilationService;
    private final CompilationBatchService batchService;
    private final ***REMOVED***CallerResolver callerResolver;

    public CompilationController(CompilationService compilationService,
                                 CompilationBatchService batchService,
                                 ***REMOVED***CallerResolver callerResolver) {
        this.compilationService = compilationService;
        this.batchService = batchService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "触发编译", description = "按当前解析稿执行 P0–P4；已完成任务直接复用")
    @PostMapping("/run")
    public ***REMOVED***Result<CompilationJobView> run(@RequestBody CompilationRunRequest body,
                                            HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.run(body.getMaterialId(), body.getVersionId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "单任务重试", description = "选择起始阶段 P0–P4 重跑，旧轮次明细保留")
    @PostMapping("/retry")
    public ***REMOVED***Result<CompilationJobView> retry(@RequestBody CompilationRetryRequest body,
                                              HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.retry(body.getJobId(), body.getStartStage(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "取消编译")
    @PostMapping("/cancel")
    public ***REMOVED***Result<CompilationJobView> cancel(@RequestBody CompilationCancelRequest body,
                                               HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.cancel(body.getJobId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "按物料查询编译任务", description = "未编译时返回 null")
    @GetMapping("/queryByMaterial")
    public ***REMOVED***Result<CompilationJobView> queryByMaterial(
            @RequestParam String materialId,
            @RequestParam(required = false) String versionId,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.queryByMaterial(materialId, versionId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "按任务查询编译详情")
    @GetMapping("/queryByJob")
    public ***REMOVED***Result<CompilationJobView> queryByJob(@RequestParam String jobId,
                                                   HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.queryByJobId(jobId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "知识库编译任务列表")
    @GetMapping("/listBy***REMOVED***")
    public ***REMOVED***Result<List<CompilationJobView>> listBy***REMOVED***(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String materialId,
            @RequestParam(required = false, defaultValue = "20") int limit,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.listBy***REMOVED***(***REMOVED***Id, materialId, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "物料检索块列表")
    @GetMapping("/listChunks")
    public ***REMOVED***Result<List<RetrievalChunkView>> listChunks(
            @RequestParam String materialId,
            @RequestParam(required = false) String versionId,
            @RequestParam(required = false, defaultValue = "100") int limit,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.listChunks(materialId, versionId, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "库内检索块关键词检索", description = "本地词法索引，按正文与标题匹配")
    @GetMapping("/search")
    public ***REMOVED***Result<List<RetrievalChunkView>> search(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, defaultValue = "20") int limit,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(compilationService.search(***REMOVED***Id, keyword, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "新建编译组别", description = "按物料多选或分类范围扇出编译单任务；同库运行中组别存在时拒绝")
    @PostMapping("/createBatch")
    public ***REMOVED***Result<CompilationBatchView> createBatch(@RequestBody CompilationBatchCreateRequest body,
                                                      HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.create(body.toParam(), callerResolver.resolve(request)));
    }

    @Operation(summary = "取消编译组别")
    @PostMapping("/cancelBatch")
    public ***REMOVED***Result<CompilationBatchView> cancelBatch(
            @RequestBody CompilationBatchCancelRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.cancel(body.getBatchId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "查询编译组别", description = "返回组别进度与成员任务")
    @GetMapping("/queryBatch")
    public ***REMOVED***Result<CompilationBatchView> queryBatch(@RequestParam String batchId,
                                                     HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.query(batchId, callerResolver.resolve(request)));
    }

    @Operation(summary = "组别列表", description = "按知识库倒序返回组别摘要，不含成员")
    @GetMapping("/listBatches")
    public ***REMOVED***Result<List<CompilationBatchView>> listBatches(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false, defaultValue = "20") int limit,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.listBy***REMOVED***(***REMOVED***Id, limit, callerResolver.resolve(request)));
    }

    @Operation(summary = "组别分页", description = "按知识库倒序分页返回组别摘要，含提交人")
    @GetMapping("/pageBatches")
    public ***REMOVED***Result<CompilationBatchPageView> pageBatches(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false, defaultValue = "1") int pageNo,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.pageBy***REMOVED***(***REMOVED***Id, pageNo, pageSize,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "是否存在运行中组别", description = "提交组别前的锁校验")
    @GetMapping("/hasRunningBatch")
    public ***REMOVED***Result<Boolean> hasRunningBatch(@RequestParam String ***REMOVED***Id,
                                             HttpServletRequest request) {
        return ***REMOVED***Result.ok(batchService.hasRunning(***REMOVED***Id, callerResolver.resolve(request)));
    }
}
