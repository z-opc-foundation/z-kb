package com.zifang.z.kb.resource.retrieval;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.retrieval.RetrievalHitView;
import com.zifang.z.kb.api.retrieval.RetrievalQueryParam;
import com.zifang.z.kb.api.retrieval.RetrievalResultView;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMentionMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 库内检索实现：向量 / 关键词 / 图谱三路召回 + RRF 融合，只保留当前物料版本的已索引段落块。
 *
 * <p><b>默认模式</b>：{@code fusion}（三路融合）。此前只有 {@code dense} 一路，
 * 实测语义改写类问题（「检索是怎么做的」）召回失败；接上 BM25 与图谱后词面与关系型问题都能覆盖。
 * {@code dense} 仍然保留且语义不变，供需要纯向量口径的调用方使用。</p>
 *
 * <p>与参考实现同口径：扫描上限 2000 块、topK 默认 10 上限 50、查询长度上限 200、
 * 过短块（&lt; 8 字符）跳过；返回得分、命中词与章节上下文解释。
 * Wiki 归属字段在 Wiki 域接入前保持为空。</p>
 */
public class DefaultKnowledgeRetrievalService implements KnowledgeRetrievalService {

    private static final int DEFAULT_TOP_K = 10;
    private static final int MAX_TOP_K = 50;
    private static final double DEFAULT_MIN_SCORE = 0.0d;
    private static final int MAX_QUERY_LENGTH = 200;
    private static final int SECTION_CONTEXT_CHARS = 1000;

    private final KnowledgeBaseResourceService resourceService;
    private final RetrievalChunkMapper chunkMapper;
    private final MaterialMapper materialMapper;
    private final LibraryRetrievalEngine engine;

    public DefaultKnowledgeRetrievalService(KnowledgeBaseResourceService resourceService,
                                            RetrievalChunkMapper chunkMapper,
                                            MaterialMapper materialMapper,
                                            GraphNodeMapper graphNodeMapper,
                                            ConceptMentionMapper mentionMapper) {
        this.resourceService = resourceService;
        this.chunkMapper = chunkMapper;
        this.materialMapper = materialMapper;
        this.engine = new LibraryRetrievalEngine(chunkMapper, materialMapper,
                graphNodeMapper, mentionMapper);
    }

    /** 兼容旧构造：只给三参时图谱路退化为空（召回退化为两路融合，不报错）。 */
    public DefaultKnowledgeRetrievalService(KnowledgeBaseResourceService resourceService,
                                            RetrievalChunkMapper chunkMapper,
                                            MaterialMapper materialMapper) {
        this(resourceService, chunkMapper, materialMapper, null, null);
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
        HybridLibrarySearcher.Mode mode = resolveMode(param.getMode());
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
        LibraryRetrievalEngine.Outcome outcome = engine.search(caller.getTenantCode(), kbId,
                query, mode, topK, minScore, null);

        Map<String, RetrievalChunkEntity> chunkMap = chunks(caller.getTenantCode(), kbId,
                outcome.getHits());
        Map<String, MaterialEntity> materialMap = materials(caller.getTenantCode(), kbId,
                chunkMap.values());

        List<RetrievalHitView> hits = new ArrayList<>();
        for (HybridLibrarySearcher.Hit hit : outcome.getHits()) {
            RetrievalChunkEntity chunk = chunkMap.get(hit.getChunkId());
            if (chunk == null) {
                continue;
            }
            RetrievalHitView view = new RetrievalHitView();
            view.setRank(hit.getRank());
            view.setChunkId(chunk.getChunkId());
            view.setMaterialId(chunk.getMaterialId());
            MaterialEntity material = materialMap.get(chunk.getMaterialId());
            view.setMaterialTitle(material == null ? null : material.getTitle());
            view.setMaterialVersionId(chunk.getMaterialVersionId());
            view.setArtifactId(chunk.getArtifactId());
            view.setOrdinal(chunk.getOrdinal());
            view.setHeading(chunk.getHeading());
            view.setContent(chunk.getContent());
            view.setParentChunkId(chunk.getParentChunkId());
            view.setCharCount(chunk.getCharCount());
            view.setScore(round(hit.getScore()));
            view.setIndexState(chunk.getIndexState());
            view.setIndexedAt(chunk.getIndexedAt());
            view.setMatchedTerms(new ArrayList<>(hit.getMatchedTerms()));
            view.setExplanation(explain(mode, hit));
            hits.add(view);
        }
        attachSectionContext(caller.getTenantCode(), hits);

        RetrievalResultView result = new RetrievalResultView();
        result.setKbId(kbId);
        result.setQuery(query);
        result.setMode(mode.name().toLowerCase(Locale.ROOT));
        result.setEmbeddingModel(engine.embedding().model());
        result.setTopK(topK);
        result.setMinScore(minScore);
        result.setTotalCandidates(outcome.getCandidateCount());
        result.setScanned(outcome.getScanned());
        result.setReturned(hits.size());
        result.setTruncated(outcome.isTruncated());
        result.setTookMs(System.currentTimeMillis() - started);
        result.setHits(hits);
        return result;
    }

    /**
     * 解析召回模式。
     *
     * <p>空值落到 {@code fusion}（三路）；{@code dense} / {@code bm25} / {@code hybrid} /
     * {@code fusion} 显式支持；未知值报错并说明可选值 —— 旧实现只说「当前只开放向量（dense）检索」，
     * 那个口径在开放多路后已经过期。</p>
     */
    private HybridLibrarySearcher.Mode resolveMode(String value) {
        if (!hasText(value)) {
            return HybridLibrarySearcher.Mode.FUSION;
        }
        HybridLibrarySearcher.Mode mode = HybridLibrarySearcher.Mode.parse(value);
        if (mode == null) {
            throw new KBException("KB_RETRIEVAL_MODE_UNSUPPORTED",
                    "检索模式只能是 dense / bm25 / hybrid / fusion");
        }
        return mode;
    }

    private Map<String, RetrievalChunkEntity> chunks(String tenantCode, String kbId,
            List<HybridLibrarySearcher.Hit> hits) {
        Map<String, RetrievalChunkEntity> result = new HashMap<>();
        Set<String> chunkIds = new LinkedHashSet<>();
        for (HybridLibrarySearcher.Hit hit : hits) {
            chunkIds.add(hit.getChunkId());
        }
        if (chunkIds.isEmpty()) {
            return result;
        }
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .in("chunk_id", chunkIds)
                .eq("is_deleted", 0);
        for (RetrievalChunkEntity chunk : chunkMapper.selectList(query)) {
            result.put(chunk.getChunkId(), chunk);
        }
        return result;
    }

    private Map<String, MaterialEntity> materials(String tenantCode, String kbId,
            java.util.Collection<RetrievalChunkEntity> chunks) {
        Map<String, MaterialEntity> result = new HashMap<>();
        Set<String> materialIds = new LinkedHashSet<>();
        for (RetrievalChunkEntity chunk : chunks) {
            materialIds.add(chunk.getMaterialId());
        }
        if (materialIds.isEmpty()) {
            return result;
        }
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .in("material_id", materialIds)
                .eq("is_deleted", 0);
        for (MaterialEntity material : materialMapper.selectList(query)) {
            result.put(material.getMaterialId(), material);
        }
        return result;
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

    /** 召回解释：说明命中来自哪几路，并给出各路得分分解。 */
    private String explain(HybridLibrarySearcher.Mode mode, HybridLibrarySearcher.Hit hit) {
        StringBuilder builder = new StringBuilder();
        builder.append("RRF 融合分 ").append(String.format(Locale.ROOT, "%.4f", hit.getScore()));
        Map<String, Double> sourceScores = hit.getSourceScores();
        if (sourceScores != null && !sourceScores.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (Map.Entry<String, Double> entry : sourceScores.entrySet()) {
                parts.add(entry.getKey() + " " + String.format(Locale.ROOT, "%.4f",
                        entry.getValue()));
            }
            builder.append("（").append(String.join(" + ", parts)).append("）");
        }
        if (!hit.getMatchedTerms().isEmpty()) {
            builder.append("；命中词「").append(String.join("、", hit.getMatchedTerms())).append("」");
        }
        if (!hit.getMatchedEntities().isEmpty()) {
            builder.append("；命中概念「").append(String.join("、", hit.getMatchedEntities()))
                    .append("」");
        }
        if (hit.getMatchedTerms().isEmpty() && hit.getMatchedEntities().isEmpty()) {
            builder.append("；正文未出现查询片段");
        }
        return builder.toString();
    }

    private static double round(double value) {
        return Math.round(value * 10000.0d) / 10000.0d;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static KBException paramInvalid() {
        return new KBException("KB_RETRIEVAL_PARAM_INVALID", "检索参数不合法");
    }
}
