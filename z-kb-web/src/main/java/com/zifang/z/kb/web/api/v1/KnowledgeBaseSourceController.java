package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.source.IngestService;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogDocsParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceDocListView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceSaveParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceService;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceSyncView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceTestParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceTestView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceView;
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

import java.util.List;

/**
 * 知识库接入源 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库接入源")
@RestController
@RequestMapping("/api/***REMOVED***/v1/knowledgeBaseSource")
public class KnowledgeBaseSourceController {

    private final KnowledgeBaseSourceService sourceService;
    private final IngestService ingestService;
    private final ***REMOVED***CallerResolver callerResolver;

    public KnowledgeBaseSourceController(KnowledgeBaseSourceService sourceService,
            IngestService ingestService, ***REMOVED***CallerResolver callerResolver) {
        this.sourceService = sourceService;
        this.ingestService = ingestService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "接入源列表", description = "按知识库查询接入源配置，凭据只返回是否已配置")
    @GetMapping("/list")
    public ***REMOVED***Result<List<KnowledgeBaseSourceView>> list(@RequestParam String ***REMOVED***Id,
                                                        HttpServletRequest request) {
        return ***REMOVED***Result.ok(sourceService.listSources(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "保存接入源", description = "全量覆盖接入源列表，传空数组表示清空")
    @PostMapping("/save")
    public ***REMOVED***Result<List<KnowledgeBaseSourceView>> save(@RequestBody KnowledgeBaseSourceSaveParam body,
                                                        HttpServletRequest request) {
        return ***REMOVED***Result.ok(sourceService.saveSources(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "测试接入源连通性", description = "只回答能不能连通，不落库、不产生任务")
    @PostMapping("/test")
    public ***REMOVED***Result<KnowledgeBaseSourceTestView> test(@RequestBody KnowledgeBaseSourceTestParam body,
                                                      HttpServletRequest request) {
        return ***REMOVED***Result.ok(sourceService.testConnection(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "加载语雀团队与知识库",
            description = "用当前填写的令牌读团队列表；scope.namespace 有值时同时返回该团队的知识库")
    @PostMapping("/yuque/catalog")
    public ***REMOVED***Result<KnowledgeBaseSourceCatalogView> yuqueCatalog(
            @RequestBody KnowledgeBaseSourceCatalogParam body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(sourceService.catalog(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "加载语雀知识库文章", description = "按库分页读取文章标题与更新时间，供勾选同步范围")
    @PostMapping("/yuque/catalogDocs")
    public ***REMOVED***Result<KnowledgeBaseSourceDocListView> yuqueCatalogDocs(
            @RequestBody KnowledgeBaseSourceCatalogDocsParam body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(sourceService.catalogDocs(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "发起接入源同步",
            description = "z-***REMOVED*** 无独立任务内核，请求内同步执行并返回计数")
    @PostMapping("/sync")
    public ***REMOVED***Result<KnowledgeBaseSourceSyncView> sync(@RequestBody SyncRequest body,
                                                      HttpServletRequest request) {
        return ***REMOVED***Result.ok(ingestService.sync(body.get***REMOVED***Id(), body.getSourceId(),
                callerResolver.resolve(request)));
    }

    /** 同步请求：知识库 + 接入源。 */
    public static class SyncRequest {

        private String ***REMOVED***Id;
        private String sourceId;

        public String get***REMOVED***Id() {
            return ***REMOVED***Id;
        }

        public void set***REMOVED***Id(String ***REMOVED***Id) {
            this.***REMOVED***Id = ***REMOVED***Id;
        }

        public String getSourceId() {
            return sourceId;
        }

        public void setSourceId(String sourceId) {
            this.sourceId = sourceId;
        }
    }
}
