package com.zifang.z.kb.resource.retrieval;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.retrieval.RetrievalHitView;
import com.zifang.z.kb.api.retrieval.RetrievalQueryParam;
import com.zifang.z.kb.api.retrieval.RetrievalResultView;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 库内 dense 检索实现：本地确定性向量召回，只保留当前物料版本的已索引段落块。
 *
 * <p>与参考实现同口径：扫描上限 2000 块、topK 默认 10 上限 50、minScore 默认 0.1、
 * 查询长度上限 200、过短块（&lt; 8 字符）跳过；返回得分、命中词与章节上下文解释。
 * Wiki 归属字段在 Wiki 域接入前保持为空。</p>
 */
public class DefaultKnowledgeRetrievalService implements KnowledgeRetrievalService {

    private static final int MAX_SCAN = 2000;
    private static final int DEFAULT_TOP_K = 10;
    private static final int MAX_TOP_K = 50;
    private static final double DEFAULT_MIN_SCORE = 0.1d;
    private static final int MAX_QUERY_LENGTH = 200;
    private static final int MIN_CONTENT_CHARS = 8;
    private static final int SECTION_CONTEXT_CHARS = 1000;
    private static final String MODE_DENSE = "dense";

    private final KnowledgeBaseResourceService resourceService;
    private final RetrievalChunkMapper chunkMapper;
    private final MaterialMapper materialMapper;
    private final LocalHashEmbedding embedding = new LocalHashEmbedding();

    public DefaultKnowledgeRetrievalService(KnowledgeBaseResourceService resourceService,
                                            RetrievalChunkMapper chunkMapper,
                                            MaterialMapper materialMapper) {
        this.resourceService = resourceService;
        this.chunkMapper = chunkMapper;
        this.materialMapper = materialMapper;
    }

    @Override
    public RetrievalResultView retrieve(RetrievalQueryParam param, KbCaller caller) {
        if (param == null || !hasText(param.getKbId()) || !hasText(param.getQuery())) {
            throw paramInvalid();
        }
        String kbId = param.getKbId().trim();
        String query = param.getQuery().trim();
        if (query.length() > MAX_QUERY_LENGTH) {
            throw paramInvalid();
        }
        String mode = hasText(param.getMode())
                ? param.getMode().trim().toLowerCase(Locale.ROOT) : MODE_DENSE;
        if (!MODE_DENSE.equals(mode)) {
            throw new KBException("KB_RETRIEVAL_MODE_UNSUPPORTED", "当前只开放向量（dense）检索");
        }
        int topK = param.getTopK() == null ? DEFAULT_TOP_K : param.getTopK();
        if (topK < 1 || topK > MAX_TOP_K) {
            throw paramInvalid();
        }
        double minScore = param.getMinScore() == null ? DEFAULT_MIN_SCORE : param.getMinScore();
        if (minScore < 0.0d || minScore > 1.0d) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId, caller);

        long started = System.currentTimeMillis();
        List<RetrievalChunkEntity> raw = listIndexedByKb(caller.getTenantCode(), kbId, MAX_SCAN + 1);
        boolean truncated = raw.size() > MAX_SCAN;
        if (truncated) {
            raw = new ArrayList<>(raw.subList(0, MAX_SCAN));
        }

        Set<String> materialIds = new LinkedHashSet<>();
        for (RetrievalChunkEntity chunk : raw) {
            materialIds.add(chunk.getMaterialId());
        }
        Map<String, MaterialEntity> materialMap = materials(caller.getTenantCode(), materialIds);

        double[] queryVector = embedding.embed(query);
        List<String> queryTerms = embedding.queryTerms(query);
        List<ScoredChunk> scored = new ArrayList<>();
        long candidateCount = 0L;
        for (RetrievalChunkEntity chunk : raw) {
            MaterialEntity material = materialMap.get(chunk.getMaterialId());
            if (material == null || !hasText(material.getCurrentVersionId())
                    || !material.getCurrentVersionId().equals(chunk.getMaterialVersionId())) {
                continue;
            }
            if (chunk.getContent() == null
                    || chunk.getContent().trim().length() < MIN_CONTENT_CHARS) {
                continue;
            }
            candidateCount++;
            double[] vector = embedding.decode(chunk.getEmbedding());
            if (vector == null || !embedding.model().equals(chunk.getEmbeddingModel())) {
                vector = embedding.embed(chunk.getContent());
                backfillEmbedding(chunk, vector, caller);
            }
            double score = Math.max(0.0d, embedding.cosine(queryVector, vector));
            if (score + 1.0e-9 < minScore) {
                continue;
            }
            scored.add(new ScoredChunk(chunk, score));
        }

        scored.sort(Comparator.comparingDouble(ScoredChunk::score).reversed()
                .thenComparing(item -> item.chunk().getMaterialId())
                .thenComparing(item -> item.chunk().getOrdinal()));

        List<RetrievalHitView> hits = new ArrayList<>();
        int rank = 1;
        for (ScoredChunk item : scored) {
            if (hits.size() >= topK) {
                break;
            }
            RetrievalChunkEntity chunk = item.chunk();
            RetrievalHitView hit = new RetrievalHitView();
            hit.setRank(rank++);
            hit.setChunkId(chunk.getChunkId());
            hit.setMaterialId(chunk.getMaterialId());
            MaterialEntity material = materialMap.get(chunk.getMaterialId());
            hit.setMaterialTitle(material == null ? null : material.getTitle());
            hit.setMaterialVersionId(chunk.getMaterialVersionId());
            hit.setArtifactId(chunk.getArtifactId());
            hit.setOrdinal(chunk.getOrdinal());
            hit.setHeading(chunk.getHeading());
            hit.setContent(chunk.getContent());
            hit.setParentChunkId(chunk.getParentChunkId());
            hit.setCharCount(chunk.getCharCount());
            hit.setScore(round(item.score()));
            hit.setIndexState(chunk.getIndexState());
            hit.setIndexedAt(chunk.getIndexedAt());

            List<String> matched = new ArrayList<>();
            for (String term : queryTerms) {
                if (contains(chunk.getHeading(), term) || contains(chunk.getContent(), term)) {
                    matched.add(term);
                }
            }
            hit.setMatchedTerms(matched);
            hit.setExplanation(explain(item.score(), matched));
            hits.add(hit);
        }
        attachSectionContext(caller.getTenantCode(), hits);

        RetrievalResultView result = new RetrievalResultView();
        result.setKbId(kbId);
        result.setQuery(query);
        result.setMode(MODE_DENSE);
        result.setEmbeddingModel(embedding.model());
        result.setTopK(topK);
        result.setMinScore(minScore);
        result.setTotalCandidates(candidateCount);
        result.setScanned(raw.size());
        result.setReturned(hits.size());
        result.setTruncated(truncated);
        result.setTookMs(System.currentTimeMillis() - started);
        result.setHits(hits);
        return result;
    }

    private List<RetrievalChunkEntity> listIndexedByKb(String tenantCode, String kbId, int limit) {
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("chunk_role", "PASSAGE")
                .eq("index_state", "INDEXED")
                .eq("is_deleted", 0)
                .orderByDesc("indexed_at")
                .orderByAsc("material_id")
                .orderByAsc("ordinal")
                .last("limit " + limit);
        return chunkMapper.selectList(query);
    }

    private Map<String, MaterialEntity> materials(String tenantCode, Set<String> materialIds) {
        Map<String, MaterialEntity> result = new HashMap<>();
        if (materialIds.isEmpty()) {
            return result;
        }
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .in("material_id", materialIds)
                .eq("is_deleted", 0);
        for (MaterialEntity material : materialMapper.selectList(query)) {
            result.put(material.getMaterialId(), material);
        }
        return result;
    }

    private void backfillEmbedding(RetrievalChunkEntity chunk, double[] vector, KbCaller caller) {
        String encoded = embedding.encode(vector);
        UpdateWrapper<RetrievalChunkEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", caller.getTenantCode())
                .eq("chunk_id", chunk.getChunkId())
                .eq("is_deleted", 0)
                .set("embedding_model", embedding.model())
                .set("embedding", encoded)
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        chunkMapper.update(null, update);
        chunk.setEmbeddingModel(embedding.model());
        chunk.setEmbedding(encoded);
    }

    /** 命中段落块时回带所属章节块正文摘录，父块缺失时保持为空。 */
    private void attachSectionContext(String tenantCode, List<RetrievalHitView> hits) {
        Set<String> parentIds = new LinkedHashSet<>();
        for (RetrievalHitView hit : hits) {
            if (hasText(hit.getParentChunkId())) {
                parentIds.add(hit.getParentChunkId());
            }
        }
        if (parentIds.isEmpty()) {
            return;
        }
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .in("chunk_id", parentIds)
                .eq("is_deleted", 0);
        Map<String, RetrievalChunkEntity> parents = new HashMap<>();
        for (RetrievalChunkEntity parent : chunkMapper.selectList(query)) {
            parents.put(parent.getChunkId(), parent);
        }
        for (RetrievalHitView hit : hits) {
            RetrievalChunkEntity parent = parents.get(hit.getParentChunkId());
            if (parent != null && hasText(parent.getContent())) {
                String content = parent.getContent();
                hit.setSectionContent(content.length() <= SECTION_CONTEXT_CHARS ? content
                        : content.substring(0, SECTION_CONTEXT_CHARS));
            }
        }
    }

    private boolean contains(String text, String term) {
        return text != null && text.toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT));
    }

    private String explain(double score, List<String> matched) {
        String base = "向量余弦 " + String.format(Locale.ROOT, "%.3f", score);
        if (matched.isEmpty()) {
            return base + "；正文未出现查询片段";
        }
        return base + "；正文命中「" + String.join("、", matched) + "」";
    }

    private static double round(double value) {
        return Math.round(value * 1000.0d) / 1000.0d;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static KBException paramInvalid() {
        return new KBException("KB_RETRIEVAL_PARAM_INVALID", "检索参数不合法");
    }

    private record ScoredChunk(RetrievalChunkEntity chunk, double score) {
    }
}
