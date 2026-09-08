package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.api.IngestResult;
import com.zifang.z.kb.ingest.pipeline.DataSourceRegistry;
import com.zifang.z.kb.ingest.pipeline.IngestPipeline;
import com.zifang.z.kb.ingest.source.WebhookSource;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 数据接入控制器 — 暴露多渠道接入能力。
 *
 * <p>路径前缀：/api/kb/ingest
 */
@Api(tags = "数据接入")
@RestController
@RequestMapping("/api/kb/ingest")
public class IngestController {

    @Autowired
    private IngestPipeline pipeline;

    @Autowired
    private DataSourceRegistry registry;

    @Autowired
    private WebhookSource webhookSource;

    @ApiOperation("列出已注册的数据源")
    @GetMapping("/sources")
    public Map<String, Object> listSources() {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> list = new ArrayList<>();
        for (DataSource s : registry.list()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sourceId", s.getSourceId());
            m.put("type", s.getType().name());
            m.put("label", s.getType().getLabel());
            m.put("enabled", s.isEnabled());
            list.add(m);
        }
        out.put("sources", list);
        out.put("supportedTypes", Arrays.stream(DataSourceType.values())
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", t.name());
                    m.put("label", t.getLabel());
                    return m;
                }).toList());
        return out;
    }

    @ApiOperation("按 sourceId 触发一次拉取 + 入库")
    @PostMapping("/run")
    public Map<String, Object> run(@RequestParam String sourceId,
                                    @RequestBody(required = false) Map<String, Object> config) {
        if (config == null) config = new LinkedHashMap<>();
        List<IngestResult> results = pipeline.ingest(sourceId, config);
        return summarize(results);
    }

    @ApiOperation("提交一组已构造好的 IngestRequest")
    @PostMapping("/submit")
    public Map<String, Object> submit(@RequestBody List<IngestRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new KBException("请求列表为空");
        }
        List<IngestResult> results = pipeline.ingestBatch(requests);
        return summarize(results);
    }

    @ApiOperation("通用 webhook 入口 — 接收 Markdown 文档")
    @PostMapping("/webhook")
    public Map<String, Object> webhook(@RequestHeader(value = "X-Signature", required = false) String signature,
                                        @RequestHeader(value = "X-Secret", required = false) String secret,
                                        @RequestBody Map<String, Object> payload) {
        String title = (String) payload.getOrDefault("title", "Webhook 文档");
        String content = (String) payload.getOrDefault("content", "");
        String workspace = (String) payload.getOrDefault("workspace", "default");
        Map<String, Object> meta = (Map<String, Object>) payload.getOrDefault("metadata", new HashMap<>());
        meta.put("workspace", workspace);

        boolean ok = webhookSource.accept(signature, secret, title, content, meta);
        if (!ok) {
            throw new KBException("webhook 校验失败");
        }
        return Map.of("accepted", true, "pending", webhookSource.pending());
    }

    @ApiOperation("拉取 webhook 缓冲并入库")
    @PostMapping("/webhook/flush")
    public Map<String, Object> flushWebhook() {
        List<IngestResult> results = pipeline.ingest(webhookSource.getSourceId(), new HashMap<>());
        return summarize(results);
    }

    @ApiOperation("查看累计统计")
    @GetMapping("/stats")
    public IngestPipeline.Stats stats() {
        return pipeline.stats();
    }

    private Map<String, Object> summarize(List<IngestResult> results) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", results.size());
        long ok = 0, fail = 0, skip = 0;
        int chunks = 0, ents = 0, rels = 0;
        List<Map<String, Object>> items = new ArrayList<>();
        for (IngestResult r : results) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("requestId", r.getRequestId());
            m.put("documentId", r.getDocumentId());
            m.put("status", r.getStatus().name());
            m.put("elapsedMillis", r.getElapsedMillis());
            m.put("chunkCount", r.getChunkCount());
            m.put("entityCount", r.getEntityCount());
            m.put("relationCount", r.getRelationCount());
            if (r.getError() != null) m.put("error", r.getError());
            items.add(m);
            if (r.getStatus() == IngestResult.Status.SUCCESS) ok++;
            else if (r.getStatus() == IngestResult.Status.FAILED) fail++;
            else if (r.getStatus() == IngestResult.Status.SKIPPED_DUPLICATE) skip++;
            chunks += r.getChunkCount();
            ents += r.getEntityCount();
            rels += r.getRelationCount();
        }
        out.put("success", ok);
        out.put("failed", fail);
        out.put("skipped", skip);
        out.put("totalChunks", chunks);
        out.put("totalEntities", ents);
        out.put("totalRelations", rels);
        out.put("items", items);
        return out;
    }
}