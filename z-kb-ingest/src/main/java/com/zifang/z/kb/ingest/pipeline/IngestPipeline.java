package com.zifang.z.kb.ingest.pipeline;

import com.zifang.z.kb.api.IndexRequest;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.api.IngestResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * 接入管道 — 编排 fetch → normalize → dedupe → index → report。
 *
 * <p>核心方法：
 * <ul>
 *   <li>{@link #ingest(String, Map)}：按 sourceId 拉取并入库</li>
 *   <li>{@link #ingestBatch(List)}：批量处理已构造好的 IngestRequest</li>
 *   <li>{@link #stats()：累计统计}</li>
 * </ul>
 */
public class IngestPipeline {

    private static final Logger log = LoggerFactory.getLogger(IngestPipeline.class);

    private final KnowledgeBaseService kbService;
    private final DataSourceRegistry registry;

    /** 幂等去重：记录已见过的 requestId */
    private final Set<String> seenIds = Collections.synchronizedSet(new HashSet<>());

    private long totalRequests;
    private long totalSuccess;
    private long totalFailed;
    private long totalSkipped;
    private long totalChunks;
    private long totalEntities;
    private long totalRelations;
    private long totalMillis;

    public IngestPipeline(KnowledgeBaseService kbService, DataSourceRegistry registry) {
        this.kbService = kbService;
        this.registry = registry;
    }

    public IngestPipeline(KnowledgeBaseService kbService) {
        this(kbService, new DataSourceRegistry().installDefaults());
    }

    /** 按 sourceId 拉取 + 入库 */
    public List<IngestResult> ingest(String sourceId, Map<String, Object> config) {
        DataSource source = registry.require(sourceId);
        List<IngestResult> results = new ArrayList<>();
        try {
            List<IngestRequest> reqs = source.fetch(config);
            log.info("[{}] 拉取到 {} 个文档", sourceId, reqs.size());
            results.addAll(ingestBatch(reqs));
        } catch (Exception e) {
            log.error("[{}] 抓取失败", sourceId, e);
            IngestResult r = IngestResult.failed(sourceId, e.getMessage());
            r.log("FETCH_ERROR: " + e.getMessage());
            results.add(r);
            totalFailed++;
        }
        return results;
    }

    /** 批量处理 IngestRequest */
    public List<IngestResult> ingestBatch(List<IngestRequest> requests) {
        List<IngestResult> results = new ArrayList<>();
        for (IngestRequest req : requests) {
            results.add(processOne(req));
        }
        return results;
    }

    private IngestResult processOne(IngestRequest req) {
        totalRequests++;
        long start = System.currentTimeMillis();
        IngestResult result = new IngestResult(req.getId(), IngestResult.Status.SUCCESS);

        try {
            if (req.getContent() == null || req.getContent().isEmpty()) {
                result.setStatus(IngestResult.Status.INVALID);
                result.setError("空内容");
                totalFailed++;
                return result;
            }

            // 去重
            synchronized (seenIds) {
                if (seenIds.contains(req.getId())) {
                    result.setStatus(IngestResult.Status.SKIPPED_DUPLICATE);
                    totalSkipped++;
                    result.setElapsedMillis(System.currentTimeMillis() - start);
                    return result;
                }
                seenIds.add(req.getId());
            }

            result.log("已标准化为 Markdown，准备索引");

            // 委托给 KnowledgeBaseService — 用 Document 承载内容
            com.zifang.z.kb.api.Document doc = com.zifang.z.kb.api.Document.builder()
                    .title(req.getTitle() != null ? req.getTitle() : "未命名文档")
                    .content(req.getContent())
                    .workspace(req.getWorkspace())
                    .author(req.getAuthor())
                    .sourceUrl(req.getSourceUrl())
                    .path(req.getPath())
                    .category(req.getCategory())
                    .tags(req.getTags() != null ? req.getTags() : new ArrayList<>())
                    .build();
            if (req.getMetadata() != null) doc.setFrontmatter(new java.util.LinkedHashMap<>(req.getMetadata()));

            IndexRequest idx = new IndexRequest();
            idx.setDocument(doc);
            idx.setWorkspace(req.getWorkspace());

            com.zifang.z.kb.api.ImportResult kr = kbService.indexDocument(idx);
            result.setDocumentId(kr.getDocumentId());
            result.setChunkCount(kr.getChunkCount());
            result.setEntityCount(kr.getEntityCount());
            result.setRelationCount(kr.getRelationCount());
            totalChunks += kr.getChunkCount();
            totalEntities += kr.getEntityCount();
            totalRelations += kr.getRelationCount();
            totalSuccess++;
            result.log("索引完成");
        } catch (Exception e) {
            log.error("处理失败: {}", req.getId(), e);
            result.setStatus(IngestResult.Status.FAILED);
            result.setError(e.getMessage());
            result.log("ERROR: " + e.getMessage());
            totalFailed++;
        } finally {
            result.setElapsedMillis(System.currentTimeMillis() - start);
            totalMillis += result.getElapsedMillis();
        }
        return result;
    }

    public Stats stats() {
        return new Stats(totalRequests, totalSuccess, totalFailed, totalSkipped,
                          totalChunks, totalEntities, totalRelations, totalMillis);
    }

    /** 累计统计快照 */
    public static class Stats {
        public final long totalRequests;
        public final long success;
        public final long failed;
        public final long skipped;
        public final long chunks;
        public final long entities;
        public final long relations;
        public final long elapsedMillis;

        public Stats(long tr, long s, long f, long sk, long c, long e, long r, long em) {
            this.totalRequests = tr; this.success = s; this.failed = f; this.skipped = sk;
            this.chunks = c; this.entities = e; this.relations = r; this.elapsedMillis = em;
        }

        public double successRate() {
            return totalRequests == 0 ? 0.0 : (success * 100.0 / totalRequests);
        }
    }
}