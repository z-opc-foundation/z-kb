package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.api.IngestResult;
import com.zifang.z.kb.ingest.pipeline.DataSourceRegistry;
import com.zifang.z.kb.ingest.pipeline.IngestPipeline;
import com.zifang.z.kb.ingest.source.WebhookSource;
import com.zifang.z.kb.protocol.request.WebhookPayload;
import com.zifang.z.kb.protocol.response.DataSourceSummary;
import com.zifang.z.kb.protocol.response.IngestItemSummary;
import com.zifang.z.kb.protocol.response.IngestSummary;
import com.zifang.z.kb.protocol.response.ListSourcesResponse;
import com.zifang.z.kb.protocol.response.SourceTypeSummary;
import com.zifang.z.kb.protocol.response.WebhookAck;
import com.zifang.util.json.JsonUtil;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
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
    public ListSourcesResponse listSources() {
        List<DataSourceSummary> list = new ArrayList<>();
        for (DataSource s : registry.list()) {
            DataSourceSummary m = new DataSourceSummary();
            m.setSourceId(s.getSourceId());
            m.setType(s.getType().name());
            m.setLabel(s.getType().getLabel());
            m.setEnabled(s.isEnabled());
            list.add(m);
        }
        List<SourceTypeSummary> types = new ArrayList<>();
        for (DataSourceType t : DataSourceType.values()) {
            types.add(new SourceTypeSummary(t.name(), t.getLabel()));
        }
        ListSourcesResponse out = new ListSourcesResponse();
        out.setSources(list);
        out.setSupportedTypes(types);
        return out;
    }

    @ApiOperation("按 sourceId 触发一次拉取 + 入库")
    @PostMapping("/run")
    public void run(@RequestParam String sourceId,
                    @RequestBody(required = false) Map<String, Object> config,
                    HttpServletResponse resp) throws IOException {
        if (config == null) config = new LinkedHashMap<>();
        writeSummary(resp, summarize(pipeline.ingest(sourceId, config)));
    }

    @ApiOperation("提交一组已构造好的 IngestRequest")
    @PostMapping("/submit")
    public void submit(@RequestBody List<IngestRequest> requests,
                       HttpServletResponse resp) throws IOException {
        if (requests == null || requests.isEmpty()) {
            throw new KBException("请求列表为空");
        }
        writeSummary(resp, summarize(pipeline.ingestBatch(requests)));
    }

    @ApiOperation("通用 webhook 入口 — 接收 Markdown 文档")
    @PostMapping("/webhook")
    public WebhookAck webhook(@RequestHeader(value = "X-Signature", required = false) String signature,
                              @RequestHeader(value = "X-Secret", required = false) String secret,
                              @RequestBody WebhookPayload payload) {
        Map<String, Object> meta = new LinkedHashMap<>(payload.getMetadata());
        meta.put("workspace", payload.getWorkspace());

        boolean ok = webhookSource.accept(signature, secret, payload.getTitle(),
                payload.getContent(), meta);
        if (!ok) {
            throw new KBException("webhook 校验失败");
        }
        return new WebhookAck(true, webhookSource.pending());
    }

    @ApiOperation("拉取 webhook 缓冲并入库")
    @PostMapping("/webhook/flush")
    public void flushWebhook(HttpServletResponse resp) throws IOException {
        writeSummary(resp, summarize(pipeline.ingest(webhookSource.getSourceId(), new HashMap<>())));
    }

    /**
     * 汇总响应由 controller 显式序列化。
     *
     * <p>原本靠 MVC 转换器 + DTO 上的类级 {@code @JsonInclude(NON_NULL)}；注解清零后
     * 改走 JsonUtil，逐字段的去留由 {@code IngestItemSummary.error} 上的
     * {@code @JsonSerialize(nonNull = true)} 单独决定 —— 不能用 toJsonExcludingNulls，
     * 那会把 documentId 等字段的 null 也一起吞掉。
     */
    private void writeSummary(HttpServletResponse resp, IngestSummary summary) throws IOException {
        resp.setContentType("application/json;charset=UTF-8");
        resp.setCharacterEncoding("UTF-8");
        resp.getWriter().write(JsonUtil.toJson(summary));
        resp.getWriter().flush();
    }

    @ApiOperation("查看累计统计")
    @GetMapping("/stats")
    public IngestPipeline.Stats stats() {
        return pipeline.stats();
    }

    private IngestSummary summarize(List<IngestResult> results) {
        IngestSummary out = new IngestSummary();
        out.setCount(results.size());
        long ok = 0, fail = 0, skip = 0;
        int chunks = 0, ents = 0, rels = 0;
        List<IngestItemSummary> items = new ArrayList<>();
        for (IngestResult r : results) {
            IngestItemSummary m = new IngestItemSummary();
            m.setRequestId(r.getRequestId());
            m.setDocumentId(r.getDocumentId());
            m.setStatus(r.getStatus().name());
            m.setElapsedMillis(r.getElapsedMillis());
            m.setChunkCount(r.getChunkCount());
            m.setEntityCount(r.getEntityCount());
            m.setRelationCount(r.getRelationCount());
            m.setError(r.getError());
            items.add(m);
            if (r.getStatus() == IngestResult.Status.SUCCESS) ok++;
            else if (r.getStatus() == IngestResult.Status.FAILED) fail++;
            else if (r.getStatus() == IngestResult.Status.SKIPPED_DUPLICATE) skip++;
            chunks += r.getChunkCount();
            ents += r.getEntityCount();
            rels += r.getRelationCount();
        }
        out.setSuccess(ok);
        out.setFailed(fail);
        out.setSkipped(skip);
        out.setTotalChunks(chunks);
        out.setTotalEntities(ents);
        out.setTotalRelations(rels);
        out.setItems(items);
        return out;
    }
}