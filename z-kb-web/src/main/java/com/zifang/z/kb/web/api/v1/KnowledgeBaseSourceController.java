package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.source.IngestService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceCatalogDocsParam;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceCatalogParam;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceCatalogView;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceDocListView;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceSaveParam;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceSyncView;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceTestParam;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceTestView;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceView;
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

import java.util.List;

/**
 * 知识库接入源 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "知识库接入源")
@RestController
@RequestMapping("/api/kb/v1/knowledgeBaseSource")
public class KnowledgeBaseSourceController {

    private final KnowledgeBaseSourceService sourceService;
    private final IngestService ingestService;
    private final KbCallerResolver callerResolver;

    public KnowledgeBaseSourceController(KnowledgeBaseSourceService sourceService,
            IngestService ingestService, KbCallerResolver callerResolver) {
        this.sourceService = sourceService;
        this.ingestService = ingestService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "接入源列表", description = "按知识库查询接入源配置，凭据只返回是否已配置")
    @GetMapping("/list")
    public KbResult<List<KnowledgeBaseSourceView>> list(@RequestParam String kbId,
                                                        HttpServletRequest request) {
        return KbResult.ok(sourceService.listSources(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "保存接入源", description = "全量覆盖接入源列表，传空数组表示清空")
    @PostMapping("/save")
    public KbResult<List<KnowledgeBaseSourceView>> save(@RequestBody KnowledgeBaseSourceSaveParam body,
                                                        HttpServletRequest request) {
        return KbResult.ok(sourceService.saveSources(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "测试接入源连通性", description = "只回答能不能连通，不落库、不产生任务")
    @PostMapping("/test")
    public KbResult<KnowledgeBaseSourceTestView> test(@RequestBody KnowledgeBaseSourceTestParam body,
                                                      HttpServletRequest request) {
        return KbResult.ok(sourceService.testConnection(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "加载语雀团队与知识库",
            description = "用当前填写的令牌读团队列表；scope.namespace 有值时同时返回该团队的知识库")
    @PostMapping("/yuque/catalog")
    public KbResult<KnowledgeBaseSourceCatalogView> yuqueCatalog(
            @RequestBody KnowledgeBaseSourceCatalogParam body, HttpServletRequest request) {
        return KbResult.ok(sourceService.catalog(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "加载语雀知识库文章", description = "按库分页读取文章标题与更新时间，供勾选同步范围")
    @PostMapping("/yuque/catalogDocs")
    public KbResult<KnowledgeBaseSourceDocListView> yuqueCatalogDocs(
            @RequestBody KnowledgeBaseSourceCatalogDocsParam body, HttpServletRequest request) {
        return KbResult.ok(sourceService.catalogDocs(body, callerResolver.resolve(request)));
    }

    @Operation(summary = "发起接入源同步",
            description = "z-kb 无独立任务内核，请求内同步执行并返回计数")
    @PostMapping("/sync")
    public KbResult<KnowledgeBaseSourceSyncView> sync(@RequestBody SyncRequest body,
                                                      HttpServletRequest request) {
        return KbResult.ok(ingestService.sync(body.getKbId(), body.getSourceId(),
                callerResolver.resolve(request)));
    }

    /** 同步请求：知识库 + 接入源。 */
    public static class SyncRequest {

        private String kbId;
        private String sourceId;

        public String getKbId() {
            return kbId;
        }

        public void setKbId(String kbId) {
            this.kbId = kbId;
        }

        public String getSourceId() {
            return sourceId;
        }

        public void setSourceId(String sourceId) {
            this.sourceId = sourceId;
        }
    }
}
