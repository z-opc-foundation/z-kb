package com.zifang.z.kb.resource.retrieval;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.kb.core.retrieval.HybridLibrarySearcher;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.core.util.HanLpTokenizer;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.kb.storage.extraction.entity.ConceptMentionEntity;
import com.zifang.z.kb.storage.extraction.entity.GraphNodeEntity;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMentionMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 库内检索引擎（存储适配层）—— 从 JDBC 取候选块与图谱关联，交给
 * {@link HybridLibrarySearcher} 做三路召回与 RRF 融合。
 *
 * <p><b>为什么要这一层</b>：检索域（{@code DefaultKnowledgeRetrievalService}）与评测域
 * （{@code EvaluationCaseScorer}）都需要「对库内已编译检索块做混合召回」，
 * 但两者此前各算各的：检索域只有 dense，评测域自己也只算 dense。
 * 评测域自算一套的后果是——把检索域改好并不会让评测指标变好，
 * 于是「检索质量」永远测不出来。本类把取数与过滤口径收敛到一处，
 * 两边共用同一份召回结果，指标才具备诊断意义。</p>
 *
 * <p><b>候选过滤口径（与既有 dense 检索一致，勿轻易放宽）</b>：
 * ① 库内该租户的 PASSAGE 块；② 只保留物料<b>当前版本</b>的块（历史版本不进召回）；
 * ③ 正文非空且长度 ≥ 下限（过短块多为标题噪声）。</p>
 */
public class LibraryRetrievalEngine {

    /** 过短块跳过阈值。 */
    static final int MIN_CONTENT_CHARS = 8;

    /** 扫描上限。 */
    public static final int MAX_SCAN = 2000;

    /** 图谱路候选概念数上限。 */
    private static final int MAX_GRAPH_CONCEPTS = 8;

    /** 单个概念最多回连的块数。 */
    private static final int MAX_CHUNKS_PER_CONCEPT = 20;

    private final RetrievalChunkMapper chunkMapper;
    private final MaterialMapper materialMapper;
    private final GraphNodeMapper graphNodeMapper;
    private final ConceptMentionMapper mentionMapper;
    private final HybridLibrarySearcher searcher;

    public LibraryRetrievalEngine(RetrievalChunkMapper chunkMapper,
            MaterialMapper materialMapper, GraphNodeMapper graphNodeMapper,
            ConceptMentionMapper mentionMapper) {
        this(chunkMapper, materialMapper, graphNodeMapper, mentionMapper,
                new HybridLibrarySearcher());
    }

    public LibraryRetrievalEngine(RetrievalChunkMapper chunkMapper,
            MaterialMapper materialMapper, GraphNodeMapper graphNodeMapper,
            ConceptMentionMapper mentionMapper, HybridLibrarySearcher searcher) {
        this.chunkMapper = chunkMapper;
        this.materialMapper = materialMapper;
        this.graphNodeMapper = graphNodeMapper;
        this.mentionMapper = mentionMapper;
        this.searcher = searcher;
    }

    public HybridLibrarySearcher searcher() {
        return searcher;
    }

    public LocalHashEmbedding embedding() {
        return searcher.embedding();
    }

    /** 引擎的一次检索结果：命中列表 + 各路计数 + 降级说明 + 候选规模。 */
    public static final class Outcome {

        private final List<HybridLibrarySearcher.Hit> hits;
        private final Map<String, Integer> routeCounts;
        private final List<String> degradedRoutes;
        private final long candidateCount;
        private final int scanned;
        private final boolean truncated;

        Outcome(List<HybridLibrarySearcher.Hit> hits, Map<String, Integer> routeCounts,
                List<String> degradedRoutes, long candidateCount, int scanned, boolean truncated) {
            this.hits = hits;
            this.routeCounts = routeCounts;
            this.degradedRoutes = degradedRoutes;
            this.candidateCount = candidateCount;
            this.scanned = scanned;
            this.truncated = truncated;
        }

        public List<HybridLibrarySearcher.Hit> getHits() { return hits; }
        public Map<String, Integer> getRouteCounts() { return routeCounts; }
        public List<String> getDegradedRoutes() { return degradedRoutes; }
        public long getCandidateCount() { return candidateCount; }
        public int getScanned() { return scanned; }
        public boolean isTruncated() { return truncated; }
    }

    /**
     * 对库内检索块做混合召回。
     *
     * @param tenantCode 租户
     * @param kbId       知识库
     * @param query      查询串
     * @param mode       召回模式
     * @param topK       返回条数
     * @param minScore   最低分
     * @param materialFilter 限定物料版本集合（评测快照用）；为空表示不过滤版本
     */
    public Outcome search(String tenantCode, String kbId, String query,
            HybridLibrarySearcher.Mode mode, int topK, double minScore,
            Set<String> materialVersionFilter) {
        List<RetrievalChunkEntity> raw = listCandidates(tenantCode, kbId, MAX_SCAN + 1,
                materialVersionFilter);
        return searchPreloaded(tenantCode, kbId, query, mode, topK, minScore, raw,
                materialVersionFilter);
    }

    /**
     * 用调用方预加载的检索块做混合召回。
     *
     * <p>评测域为了算指标已经把快照内的块全查出来了，再让引擎自己查一遍是纯浪费；
     * 这里的入口保证「评测测的就是检索域真正用的那套召回」。</p>
     */
    public Outcome searchPreloaded(String tenantCode, String kbId, String query,
            HybridLibrarySearcher.Mode mode, int topK, double minScore,
            List<RetrievalChunkEntity> preloaded, Set<String> materialVersionFilter) {
        List<RetrievalChunkEntity> raw = preloaded == null
                ? new ArrayList<>() : new ArrayList<>(preloaded);
        boolean truncated = raw.size() > MAX_SCAN;
        if (truncated) {
            raw = new ArrayList<>(raw.subList(0, MAX_SCAN));
        }
        Map<String, MaterialEntity> materialMap = materials(tenantCode, kbId, raw);

        List<HybridLibrarySearcher.Candidate> candidates = new ArrayList<>();
        long candidateCount = 0L;
        for (RetrievalChunkEntity chunk : raw) {
            if (!accept(chunk, materialMap, materialVersionFilter)) {
                continue;
            }
            candidateCount++;
            double[] vector = searcher.embedding().decode(chunk.getEmbedding());
            if (vector == null || !searcher.embedding().model().equals(chunk.getEmbeddingModel())) {
                vector = searcher.embedding().embed(chunk.getContent());
                // 向量缺失或模型换代时补算并写库：否则这一块永远只能靠词面/图谱路召回，
                // 换模型后 dense 路会静默失效（沿用旧 dense 检索的回填语义）。
                backfillEmbedding(chunk, vector, tenantCode);
            }
            candidates.add(new HybridLibrarySearcher.Candidate(chunk.getChunkId(),
                    chunk.getMaterialId(), chunk.getContent(), chunk.getHeading(), vector));
        }

        List<HybridLibrarySearcher.GraphHit> graphHits = mode == HybridLibrarySearcher.Mode.FUSION
                ? graphHits(tenantCode, kbId, query, raw, materialVersionFilter)
                : Collections.emptyList();
        HybridLibrarySearcher.Result result = searcher.search(mode, query, candidates, graphHits,
                topK, minScore, new HybridLibrarySearcher.Weights());
        return new Outcome(result.getHits(), result.getRouteCounts(), result.getDegradedRoutes(),
                candidateCount, raw.size(), truncated);
    }

    /** 便捷重载：不限定物料版本。 */
    public Outcome search(String tenantCode, String kbId, String query,
            HybridLibrarySearcher.Mode mode, int topK, double minScore) {
        return search(tenantCode, kbId, query, mode, topK, minScore, null);
    }

    /**
     * 图谱路召回：查询词 → 命中概念 → 概念的提及 → 提及所属物料版本的检索块。
     *
     * <p><b>为什么必须走「概念」中转</b>：图谱节点是 MATERIAL / CONCEPT 两类，
     * CONCEPT 节点只带 conceptId 与 materialId，没有 chunkId；
     * 真正能落到「可召回的块」的是概念提及表里的 materialVersionId + chunkOrdinal。
     * 直接拿节点去 join 块是接不上的。</p>
     */
    private List<HybridLibrarySearcher.GraphHit> graphHits(String tenantCode, String kbId,
            String query, List<RetrievalChunkEntity> raw, Set<String> versionFilter) {
        List<HybridLibrarySearcher.GraphHit> hits = new ArrayList<>();
        if (query == null || query.trim().isEmpty()) {
            return hits;
        }
        // 图谱路是可选能力：图谱 mapper 未装配（最小装配场景）时优雅跳过，
        // 不能让整个检索因为「没有图谱」而 NPE —— 向量与词面两路仍要能出结果。
        if (graphNodeMapper == null || mentionMapper == null) {
            return hits;
        }
        List<String> terms = HanLpTokenizer.tokenize(query);
        if (terms.isEmpty()) {
            return hits;
        }
        // 候选块按 materialId + materialVersionId 建索引，图谱命中回连时才能定位到块
        Map<String, List<RetrievalChunkEntity>> byMaterial = new LinkedHashMap<>();
        for (RetrievalChunkEntity chunk : raw) {
            byMaterial.computeIfAbsent(chunk.getMaterialId(), key -> new ArrayList<>()).add(chunk);
        }
        QueryWrapper<GraphNodeEntity> nodeQuery = new QueryWrapper<>();
        nodeQuery.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("node_type", "CONCEPT")
                .eq("is_deleted", 0)
                .last("LIMIT 500");
        List<GraphNodeEntity> nodes = graphNodeMapper.selectList(nodeQuery);
        if (nodes.isEmpty()) {
            return hits;
        }
        // 概念名 → 节点：按名称包含查询词匹配
        Map<String, GraphNodeEntity> matched = new LinkedHashMap<>();
        for (GraphNodeEntity node : nodes) {
            String name = node.getName();
            if (name == null || name.trim().isEmpty()) {
                continue;
            }
            String lowerName = name.toLowerCase(Locale.ROOT);
            for (String term : terms) {
                if (lowerName.contains(term.toLowerCase(Locale.ROOT))) {
                    matched.putIfAbsent(name, node);
                    break;
                }
            }
        }
        if (matched.isEmpty()) {
            return hits;
        }
        Set<String> conceptIds = new HashSet<>();
        for (GraphNodeEntity node : matched.values()) {
            if (node.getConceptId() != null) {
                conceptIds.add(node.getConceptId());
            }
        }
        if (conceptIds.isEmpty()) {
            return hits;
        }
        QueryWrapper<ConceptMentionEntity> mentionQuery = new QueryWrapper<>();
        mentionQuery.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .in("concept_id", conceptIds)
                .last("LIMIT " + (MAX_GRAPH_CONCEPTS * MAX_CHUNKS_PER_CONCEPT));
        List<ConceptMentionEntity> mentions = mentionMapper.selectList(mentionQuery);
        if (mentions.isEmpty()) {
            return hits;
        }
        Map<String, Integer> chunkWeights = new LinkedHashMap<>();
        Map<String, String> chunkConcept = new LinkedHashMap<>();
        for (ConceptMentionEntity mention : mentions) {
            if (versionFilter != null && mention.getMaterialVersionId() != null
                    && !versionFilter.contains(mention.getMaterialVersionId())) {
                continue;
            }
            List<RetrievalChunkEntity> chunks = byMaterial.get(mention.getMaterialId());
            if (chunks == null || chunks.isEmpty()) {
                continue;
            }
            int ordinal = mention.getChunkOrdinal() == null ? 0 : mention.getChunkOrdinal();
            int weight = mention.getOccurrenceCount() == null ? 1 : mention.getOccurrenceCount();
            for (RetrievalChunkEntity chunk : chunks) {
                int chunkOrdinal = chunk.getOrdinal() == null ? 0 : chunk.getOrdinal();
                // chunkOrdinal 记的是抽取时的块序号（1 起），取该块及其所在段落
                if (chunkOrdinal > 0 && Math.abs(chunkOrdinal - ordinal) > 1) {
                    continue;
                }
                String chunkId = chunk.getChunkId();
                chunkWeights.merge(chunkId, weight, Integer::sum);
                chunkConcept.putIfAbsent(chunkId, mention.getConceptId());
            }
        }
        for (Map.Entry<String, Integer> entry : chunkWeights.entrySet()) {
            hits.add(new HybridLibrarySearcher.GraphHit(entry.getKey(),
                    chunkConcept.get(entry.getKey()), entry.getValue()));
        }
        return hits;
    }

    /**
     * 向量缺失或模型换代时补算并写库。
     *
     * <p>沿用旧 dense 检索的回填语义：命中过一次就把向量落库，
     * 后续召回不必重复计算，模型升级时也能自动迁移。</p>
     */
    private void backfillEmbedding(RetrievalChunkEntity chunk, double[] vector, String tenantCode) {
        String encoded = searcher.embedding().encode(vector);
        UpdateWrapper<RetrievalChunkEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", tenantCode)
                .eq("chunk_id", chunk.getChunkId())
                .eq("is_deleted", 0)
                .set("embedding_model", searcher.embedding().model())
                .set("embedding", encoded)
                .set("update_time", Instant.now());
        chunkMapper.update(null, update);
        chunk.setEmbeddingModel(searcher.embedding().model());
        chunk.setEmbedding(encoded);
    }

    /** 候选块是否可进入召回。 */
    private boolean accept(RetrievalChunkEntity chunk, Map<String, MaterialEntity> materialMap,
            Set<String> versionFilter) {        if (chunk.getContent() == null || chunk.getContent().trim().length() < MIN_CONTENT_CHARS) {
            return false;
        }
        if (versionFilter != null && chunk.getMaterialVersionId() != null
                && !versionFilter.contains(chunk.getMaterialVersionId())) {
            return false;
        }
        MaterialEntity material = materialMap.get(chunk.getMaterialId());
        if (material == null) {
            return false;
        }
        if (versionFilter != null) {
            // 评测快照口径：快照已限定版本集合，此时不再要求「当前版本」
            return true;
        }
        // 常规口径：只召回物料当前版本的块，历史版本不进召回
        return material.getCurrentVersionId() != null
                && material.getCurrentVersionId().equals(chunk.getMaterialVersionId());
    }

    private List<RetrievalChunkEntity> listCandidates(String tenantCode, String kbId, int limit,
            Set<String> versionFilter) {
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("chunk_role", "PASSAGE")
                .eq("index_state", "INDEXED")
                .eq("is_deleted", 0);
        if (versionFilter != null && !versionFilter.isEmpty()) {
            query.in("material_version_id", versionFilter);
        }
        query.orderByDesc("indexed_at")
                .orderByAsc("material_id")
                .orderByAsc("ordinal")
                .last("limit " + limit);
        return chunkMapper.selectList(query);
    }

    private Map<String, MaterialEntity> materials(String tenantCode, String kbId,
            List<RetrievalChunkEntity> raw) {
        Set<String> materialIds = new LinkedHashSet<>();
        for (RetrievalChunkEntity chunk : raw) {
            materialIds.add(chunk.getMaterialId());
        }
        Map<String, MaterialEntity> result = new HashMap<>();
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
}
