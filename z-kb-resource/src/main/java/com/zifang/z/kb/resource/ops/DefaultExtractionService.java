package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.extraction.ExtractionCountView;
import com.zifang.z.kb.api.extraction.ExtractionInput;
import com.zifang.z.kb.api.extraction.ExtractionItemView;
import com.zifang.z.kb.api.extraction.ExtractionMaterialView;
import com.zifang.z.kb.api.extraction.ExtractionService;
import com.zifang.z.kb.api.material.MaterialCompileSource;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.core.extraction.ConceptCandidate;
import com.zifang.z.kb.core.extraction.ConceptNames;
import com.zifang.z.kb.core.extraction.ExtractionEdgeDraft;
import com.zifang.z.kb.core.extraction.ExtractionEngine;
import com.zifang.z.kb.core.extraction.ExtractionItemDraft;
import com.zifang.z.kb.core.extraction.ExtractionNodeDraft;
import com.zifang.z.kb.core.extraction.ExtractionResult;
import com.zifang.z.kb.storage.compilation.entity.CompilationStageEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationStageMapper;
import com.zifang.z.kb.storage.extraction.entity.ConceptEntity;
import com.zifang.z.kb.storage.extraction.entity.ConceptMentionEntity;
import com.zifang.z.kb.storage.extraction.entity.ExtractionItemEntity;
import com.zifang.z.kb.storage.extraction.entity.GraphEdgeEntity;
import com.zifang.z.kb.storage.extraction.entity.GraphNodeEntity;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMapper;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMentionMapper;
import com.zifang.z.kb.storage.extraction.mapper.ExtractionItemMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphEdgeMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 本地规则萃取默认实现：P4 阶段按物料版本覆盖落库，概念按知识库归一并刷新计数。
 */
public class DefaultExtractionService implements ExtractionService {

    private static final int MAX_DEFINITION_CHARS = 500;

    private static final int MAX_NAME_CHARS = 255;

    private static final String NONE = "NONE";

    private final ExtractionEngine engine;

    private final ExtractionItemMapper itemMapper;

    private final ConceptMapper conceptMapper;

    private final ConceptMentionMapper mentionMapper;

    private final GraphNodeMapper nodeMapper;

    private final GraphEdgeMapper edgeMapper;

    private final CompilationStageMapper stageMapper;

    private final MaterialService materialService;

    public DefaultExtractionService(ExtractionEngine engine,
                                    ExtractionItemMapper itemMapper,
                                    ConceptMapper conceptMapper,
                                    ConceptMentionMapper mentionMapper,
                                    GraphNodeMapper nodeMapper,
                                    GraphEdgeMapper edgeMapper,
                                    CompilationStageMapper stageMapper,
                                    MaterialService materialService) {
        this.engine = engine;
        this.itemMapper = itemMapper;
        this.conceptMapper = conceptMapper;
        this.mentionMapper = mentionMapper;
        this.nodeMapper = nodeMapper;
        this.edgeMapper = edgeMapper;
        this.stageMapper = stageMapper;
        this.materialService = materialService;
    }

    @Override
    public ExtractionMaterialView queryByMaterial(String materialId, KbCaller caller) {
        if (materialId == null || materialId.trim().isEmpty()) {
            throw new KBException("MATERIAL_PARAM_INVALID", "物料参数不合法");
        }
        MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(), null,
                caller);
        String tenant = caller.getTenantCode();

        ExtractionMaterialView view = new ExtractionMaterialView();
        view.setMaterialId(source.getMaterialId());
        view.setMaterialVersionId(source.getVersionId());
        view.setMilestone(milestoneOf(tenant, source.getVersionId()));

        ExtractionCountView counts = new ExtractionCountView();
        Map<String, ConceptLink> links = conceptLinks(tenant, source.getVersionId());
        QueryWrapper<ExtractionItemEntity> query = new QueryWrapper<ExtractionItemEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", source.getVersionId())
                .eq("is_deleted", 0)
                .orderByAsc("item_type").orderByAsc("seq").orderByAsc("id");
        for (ExtractionItemEntity item : itemMapper.selectList(query)) {
            ExtractionItemView itemView = toItemView(item);
            applyConceptLink(itemView, links.get(item.getItemId()));
            if (ExtractionEngine.TYPE_SUMMARY.equals(item.getItemType())) {
                if (view.getSummary() == null) {
                    view.setSummary(itemView);
                }
                counts.setSummary(counts.getSummary() + 1);
            } else if (ExtractionEngine.TYPE_QUESTION.equals(item.getItemType())) {
                view.getQuestions().add(itemView);
                counts.setQuestion(counts.getQuestion() + 1);
            } else if (ExtractionEngine.TYPE_TERM.equals(item.getItemType())) {
                view.getTerms().add(itemView);
                counts.setTerm(counts.getTerm() + 1);
            } else if (ExtractionEngine.TYPE_FAQ.equals(item.getItemType())) {
                view.getFaqs().add(itemView);
                counts.setFaq(counts.getFaq() + 1);
            }
        }
        counts.setGraphNode((int) countNodes(tenant, source.getMaterialId()));
        counts.setGraphEdge((int) countEdges(tenant, source.getMaterialId()));
        view.setCounts(counts);
        return view;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExtractionCountView extract(ExtractionInput input, KbCaller caller) {
        if (input == null || !hasText(input.getKbId()) || !hasText(input.getMaterialId())
                || !hasText(input.getMaterialVersionId())) {
            throw new KBException("MATERIAL_PARAM_INVALID", "物料参数不合法");
        }
        String tenant = caller.getTenantCode();
        String kbId = input.getKbId();
        String materialId = input.getMaterialId();
        String versionId = input.getMaterialVersionId();
        Instant now = Instant.now();

        ExtractionResult result = engine.extract(input);
        Set<String> touched = removePrevious(tenant, kbId, materialId, versionId);
        Map<String, String> conceptIdByName = applyConcepts(input, result.getConcepts(), caller,
                touched, now);
        applyConceptModel(result, conceptIdByName);

        for (ExtractionItemDraft draft : result.getItems()) {
            ExtractionItemEntity entity = new ExtractionItemEntity();
            entity.setId(UUID.randomUUID().toString());
            entity.setItemId(draft.getItemId());
            entity.setTenantCode(tenant);
            entity.setKbId(kbId);
            entity.setMaterialId(materialId);
            entity.setMaterialVersionId(versionId);
            entity.setItemType(draft.getItemType());
            entity.setSeq(draft.getSeq() == null ? 0 : draft.getSeq());
            entity.setTitle(draft.getTitle());
            entity.setContent(draft.getContent());
            entity.setEvidenceJson(draft.getEvidenceJson());
            entity.setIsDeleted(0);
            entity.setCreateBy(caller.getActorId());
            entity.setUpdateBy(caller.getActorId());
            entity.setCreateTime(now);
            entity.setUpdateTime(now);
            itemMapper.insert(entity);
        }

        String spaceKey = ExtractionEngine.graphSpaceKey(kbId);
        for (ExtractionNodeDraft draft : result.getNodes()) {
            GraphNodeEntity entity = new GraphNodeEntity();
            entity.setId(UUID.randomUUID().toString());
            entity.setNodeId(draft.getNodeId());
            entity.setTenantCode(tenant);
            entity.setKbId(kbId);
            entity.setGraphSpaceKey(spaceKey);
            entity.setNodeType(draft.getNodeType());
            if (ExtractionEngine.NODE_CONCEPT.equals(draft.getNodeType())) {
                entity.setConceptId(conceptIdByName.get(draft.getName().trim()));
            }
            entity.setName(draft.getName());
            entity.setMaterialId(materialId);
            entity.setEvidenceJson(draft.getEvidenceJson());
            entity.setIsDeleted(0);
            entity.setCreateBy(caller.getActorId());
            entity.setUpdateBy(caller.getActorId());
            entity.setCreateTime(now);
            entity.setUpdateTime(now);
            nodeMapper.insert(entity);
        }
        for (ExtractionEdgeDraft draft : result.getEdges()) {
            GraphEdgeEntity entity = new GraphEdgeEntity();
            entity.setId(UUID.randomUUID().toString());
            entity.setEdgeId(draft.getEdgeId());
            entity.setTenantCode(tenant);
            entity.setKbId(kbId);
            entity.setGraphSpaceKey(spaceKey);
            entity.setEdgeType(draft.getEdgeType());
            entity.setSourceNodeId(draft.getSourceNodeId());
            entity.setTargetNodeId(draft.getTargetNodeId());
            entity.setMaterialId(materialId);
            entity.setEvidenceJson(draft.getEvidenceJson());
            entity.setIsDeleted(0);
            entity.setCreateBy(caller.getActorId());
            entity.setUpdateBy(caller.getActorId());
            entity.setCreateTime(now);
            entity.setUpdateTime(now);
            edgeMapper.insert(entity);
        }

        ExtractionCountView counts = new ExtractionCountView();
        for (ExtractionItemDraft draft : result.getItems()) {
            if (ExtractionEngine.TYPE_SUMMARY.equals(draft.getItemType())) {
                counts.setSummary(counts.getSummary() + 1);
            } else if (ExtractionEngine.TYPE_QUESTION.equals(draft.getItemType())) {
                counts.setQuestion(counts.getQuestion() + 1);
            } else if (ExtractionEngine.TYPE_TERM.equals(draft.getItemType())) {
                counts.setTerm(counts.getTerm() + 1);
            } else if (ExtractionEngine.TYPE_FAQ.equals(draft.getItemType())) {
                counts.setFaq(counts.getFaq() + 1);
            }
        }
        counts.setGraphNode(result.getNodes().size());
        counts.setGraphEdge(result.getEdges().size());
        return counts;
    }

    /** 清除同一物料版本旧的萃取条目、提及与图谱，返回受影响的概念标识供重算计数。 */
    private Set<String> removePrevious(String tenant, String kbId, String materialId,
                                       String versionId) {
        Set<String> touched = new LinkedHashSet<>();
        QueryWrapper<ConceptMentionEntity> mentionQuery = new QueryWrapper<ConceptMentionEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", versionId)
                .eq("is_deleted", 0);
        for (ConceptMentionEntity mention : mentionMapper.selectList(mentionQuery)) {
            touched.add(mention.getConceptId());
        }
        mentionMapper.delete(new QueryWrapper<ConceptMentionEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", versionId));
        itemMapper.delete(new QueryWrapper<ExtractionItemEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", versionId));
        nodeMapper.delete(new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId));
        edgeMapper.delete(new QueryWrapper<GraphEdgeEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId));
        return touched;
    }

    /** 按归一化名称新增或复用概念并写入提及，返回概念名称到概念标识的映射。 */
    private Map<String, String> applyConcepts(ExtractionInput input,
                                              List<ConceptCandidate> candidates,
                                              KbCaller caller, Set<String> touched,
                                              Instant now) {
        Map<String, String> conceptIdByName = new LinkedHashMap<>();
        String tenant = caller.getTenantCode();
        String kbId = input.getKbId();
        for (Map.Entry<String, ConceptCandidate> entry
                : mergeByNormalizedName(candidates).entrySet()) {
            ConceptCandidate candidate = entry.getValue();
            ConceptEntity concept = findByNormalizedName(tenant, kbId, entry.getKey());
            if (concept == null) {
                concept = new ConceptEntity();
                concept.setId(UUID.randomUUID().toString());
                concept.setConceptId(ConceptNames.conceptIdOf(tenant, kbId, entry.getKey()));
                concept.setTenantCode(tenant);
                concept.setKbId(kbId);
                concept.setName(truncate(candidate.getName().trim(), MAX_NAME_CHARS));
                concept.setNormalizedName(entry.getKey());
                concept.setConceptType("TERM");
                concept.setStatus("EMERGING");
                concept.setDefinition(truncate(candidate.getDefinition(), MAX_DEFINITION_CHARS));
                concept.setMentionCount(0);
                concept.setMaterialCount(0);
                concept.setFirstMaterialId(input.getMaterialId());
                concept.setLastMaterialId(input.getMaterialId());
                concept.setEvidenceJson(candidate.getEvidenceJson());
                concept.setIsDeleted(0);
                concept.setCreateBy(caller.getActorId());
                concept.setUpdateBy(caller.getActorId());
                concept.setCreateTime(now);
                concept.setUpdateTime(now);
                conceptMapper.insert(concept);
            } else {
                if (!hasText(concept.getDefinition())
                        && hasText(candidate.getDefinition())) {
                    concept.setDefinition(truncate(candidate.getDefinition(),
                            MAX_DEFINITION_CHARS));
                }
                if (!hasText(concept.getFirstMaterialId())) {
                    concept.setFirstMaterialId(input.getMaterialId());
                }
                concept.setLastMaterialId(input.getMaterialId());
                concept.setUpdateBy(caller.getActorId());
                concept.setUpdateTime(now);
                conceptMapper.updateById(concept);
            }
            conceptIdByName.put(candidate.getName().trim(), concept.getConceptId());
            for (ConceptCandidate same : candidates) {
                if (same != null && hasText(same.getName())
                        && entry.getKey().equals(ConceptNames.normalize(same.getName()))) {
                    conceptIdByName.put(same.getName().trim(), concept.getConceptId());
                }
            }
            touched.add(concept.getConceptId());

            ConceptMentionEntity mention = new ConceptMentionEntity();
            mention.setId(UUID.randomUUID().toString());
            mention.setMentionId(UUID.randomUUID().toString());
            mention.setTenantCode(tenant);
            mention.setKbId(kbId);
            mention.setConceptId(concept.getConceptId());
            mention.setMaterialId(input.getMaterialId());
            mention.setMaterialVersionId(input.getMaterialVersionId());
            mention.setMaterialTitle(truncate(input.getMaterialTitle(), MAX_NAME_CHARS));
            mention.setExtractionItemId(candidate.getExtractionItemId());
            mention.setChunkOrdinal(candidate.getChunkOrdinal() == null
                    ? 0 : candidate.getChunkOrdinal());
            mention.setOccurrenceCount(Math.max(1, candidate.getOccurrenceCount() == null
                    ? 1 : candidate.getOccurrenceCount()));
            mention.setEvidenceJson(candidate.getEvidenceJson());
            mention.setIsDeleted(0);
            mention.setCreateBy(caller.getActorId());
            mention.setUpdateBy(caller.getActorId());
            mention.setCreateTime(now);
            mention.setUpdateTime(now);
            mentionMapper.insert(mention);
        }
        refreshCounters(tenant, kbId, new ArrayList<>(touched), now);
        return conceptIdByName;
    }

    /** 依据现有提及重算概念的提及次数与来源物料数，物料数达 2 个及以上标记为已确认。 */
    private void refreshCounters(String tenant, String kbId, List<String> conceptIds,
                                 Instant now) {
        if (conceptIds.isEmpty()) {
            return;
        }
        QueryWrapper<ConceptMentionEntity> query = new QueryWrapper<ConceptMentionEntity>()
                .eq("tenant_code", tenant)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .in("concept_id", conceptIds);
        Map<String, Integer> mentionCounts = new HashMap<>();
        Map<String, Set<String>> materials = new HashMap<>();
        for (ConceptMentionEntity mention : mentionMapper.selectList(query)) {
            String conceptId = mention.getConceptId();
            int occurrence = mention.getOccurrenceCount() == null
                    ? 1 : mention.getOccurrenceCount();
            mentionCounts.merge(conceptId, occurrence, Integer::sum);
            materials.computeIfAbsent(conceptId, key -> new LinkedHashSet<>())
                    .add(mention.getMaterialId());
        }
        for (String conceptId : conceptIds) {
            ConceptEntity concept = findByConceptId(tenant, kbId, conceptId);
            if (concept == null) {
                continue;
            }
            int materialCount = materials.getOrDefault(conceptId, new LinkedHashSet<>()).size();
            concept.setMentionCount(mentionCounts.getOrDefault(conceptId, 0));
            concept.setMaterialCount(materialCount);
            concept.setStatus(materialCount >= 2 ? "CONFIRMED" : "EMERGING");
            concept.setUpdateTime(now);
            conceptMapper.updateById(concept);
        }
    }

    /**
     * 把概念节点的每物料投影改为库级概念标识，并重算边的稳定标识。
     */
    private void applyConceptModel(ExtractionResult result, Map<String, String> conceptIdByName) {
        if (conceptIdByName.isEmpty()) {
            return;
        }
        Map<String, String> nodeIdMapping = new HashMap<>();
        for (ExtractionNodeDraft node : result.getNodes()) {
            if (!ExtractionEngine.NODE_CONCEPT.equals(node.getNodeType())) {
                continue;
            }
            String conceptId = conceptIdByName.get(node.getName() == null
                    ? null : node.getName().trim());
            if (!hasText(conceptId)) {
                continue;
            }
            String oldNodeId = node.getNodeId();
            String newNodeId = "concept:" + conceptId;
            node.setNodeId(newNodeId);
            nodeIdMapping.put(oldNodeId, newNodeId);
        }

        Map<String, ExtractionEdgeDraft> edges = new LinkedHashMap<>();
        for (ExtractionEdgeDraft edge : result.getEdges()) {
            String source = nodeIdMapping.getOrDefault(edge.getSourceNodeId(),
                    edge.getSourceNodeId());
            String target = nodeIdMapping.getOrDefault(edge.getTargetNodeId(),
                    edge.getTargetNodeId());
            edge.setSourceNodeId(source);
            edge.setTargetNodeId(target);
            edge.setEdgeId(ExtractionEngine.edgeId(source, target, edge.getEdgeType()));
            edges.putIfAbsent(edge.getEdgeId(), edge);
        }
        result.setEdges(new ArrayList<>(edges.values()));
    }

    /** 以归一化名称为键合并候选概念，累加出现次数并补齐释义与首个萃取条目。 */
    private static Map<String, ConceptCandidate> mergeByNormalizedName(
            List<ConceptCandidate> candidates) {
        Map<String, ConceptCandidate> merged = new LinkedHashMap<>();
        if (candidates == null) {
            return merged;
        }
        for (ConceptCandidate candidate : candidates) {
            if (candidate == null || !hasText(candidate.getName())) {
                continue;
            }
            String normalized = ConceptNames.normalize(candidate.getName());
            if (normalized.isEmpty()) {
                continue;
            }
            ConceptCandidate existing = merged.get(normalized);
            if (existing == null) {
                candidate.setName(candidate.getName().trim());
                candidate.setOccurrenceCount(Math.max(1, candidate.getOccurrenceCount() == null
                        ? 1 : candidate.getOccurrenceCount()));
                merged.put(normalized, candidate);
            } else {
                existing.setOccurrenceCount(existing.getOccurrenceCount()
                        + Math.max(1, candidate.getOccurrenceCount() == null
                        ? 1 : candidate.getOccurrenceCount()));
                if (!hasText(existing.getDefinition())
                        && hasText(candidate.getDefinition())) {
                    existing.setDefinition(candidate.getDefinition());
                }
                if (!hasText(existing.getExtractionItemId())) {
                    existing.setExtractionItemId(candidate.getExtractionItemId());
                }
            }
        }
        return merged;
    }

    /** 该物料版本最新的里程碑：全阶段成功为 M2，索引成功为 M1，其余 NONE。 */
    private String milestoneOf(String tenant, String versionId) {
        QueryWrapper<CompilationStageEntity> latestQuery =
                new QueryWrapper<CompilationStageEntity>()
                        .eq("tenant_code", tenant)
                        .eq("material_version_id", versionId)
                        .eq("is_deleted", 0)
                        .orderByDesc("create_time").orderByDesc("id")
                        .last("LIMIT 1");
        CompilationStageEntity latest = stageMapper.selectOne(latestQuery);
        if (latest == null) {
            return NONE;
        }
        QueryWrapper<CompilationStageEntity> roundQuery =
                new QueryWrapper<CompilationStageEntity>()
                        .eq("tenant_code", tenant)
                        .eq("job_id", latest.getJobId())
                        .eq("round_no", latest.getRoundNo() == null ? 1
                                : latest.getRoundNo())
                        .eq("material_version_id", versionId)
                        .eq("is_deleted", 0);
        boolean allSucceeded = true;
        boolean indexSucceeded = false;
        List<CompilationStageEntity> rows = stageMapper.selectList(roundQuery);
        for (CompilationStageEntity row : rows) {
            String status = row.getStatus();
            if (!"SUCCEEDED".equals(status) && !"SKIPPED".equals(status)) {
                allSucceeded = false;
            }
            if ("INDEX".equals(row.getStage()) && "SUCCEEDED".equals(status)) {
                indexSucceeded = true;
            }
        }
        if (!rows.isEmpty() && allSucceeded) {
            return "M2";
        }
        return indexSucceeded ? "M1" : NONE;
    }

    /** 按物料版本汇总概念链接，供萃取条目回显关联概念。 */
    private Map<String, ConceptLink> conceptLinks(String tenant, String versionId) {
        Map<String, ConceptLink> links = new LinkedHashMap<>();
        QueryWrapper<ConceptMentionEntity> query = new QueryWrapper<ConceptMentionEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", versionId)
                .eq("is_deleted", 0);
        Map<String, ConceptEntity> cache = new HashMap<>();
        for (ConceptMentionEntity mention : mentionMapper.selectList(query)) {
            if (!hasText(mention.getExtractionItemId())
                    || !hasText(mention.getConceptId())) {
                continue;
            }
            ConceptEntity concept = cache.computeIfAbsent(mention.getConceptId(),
                    id -> findByConceptId(tenant, mention.getKbId(), id));
            if (concept == null) {
                continue;
            }
            ConceptLink link = new ConceptLink();
            link.conceptId = concept.getConceptId();
            link.name = concept.getName();
            link.status = concept.getStatus();
            links.putIfAbsent(mention.getExtractionItemId(), link);
        }
        return links;
    }

    private void applyConceptLink(ExtractionItemView view, ConceptLink link) {
        if (link == null) {
            return;
        }
        view.setConceptId(link.conceptId);
        view.setConceptName(link.name);
        view.setConceptStatus(link.status);
    }

    private ConceptEntity findByNormalizedName(String tenant, String kbId, String normalizedName) {
        QueryWrapper<ConceptEntity> query = new QueryWrapper<ConceptEntity>()
                .eq("tenant_code", tenant)
                .eq("kb_id", kbId)
                .eq("normalized_name", normalizedName)
                .eq("is_deleted", 0)
                .last("LIMIT 1");
        return conceptMapper.selectOne(query);
    }

    private ConceptEntity findByConceptId(String tenant, String kbId, String conceptId) {
        QueryWrapper<ConceptEntity> query = new QueryWrapper<ConceptEntity>()
                .eq("tenant_code", tenant)
                .eq("kb_id", kbId)
                .eq("concept_id", conceptId)
                .eq("is_deleted", 0)
                .last("LIMIT 1");
        return conceptMapper.selectOne(query);
    }

    private long countNodes(String tenant, String materialId) {
        Long total = nodeMapper.selectCount(new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("is_deleted", 0));
        return total == null ? 0L : total;
    }

    private long countEdges(String tenant, String materialId) {
        Long total = edgeMapper.selectCount(new QueryWrapper<GraphEdgeEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("is_deleted", 0));
        return total == null ? 0L : total;
    }

    private ExtractionItemView toItemView(ExtractionItemEntity item) {
        ExtractionItemView view = new ExtractionItemView();
        view.setItemId(item.getItemId());
        view.setItemType(item.getItemType());
        view.setSeq(item.getSeq());
        view.setTitle(item.getTitle());
        view.setContent(item.getContent());
        view.setEvidence(item.getEvidenceJson());
        return view;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static final class ConceptLink {

        private String conceptId;

        private String name;

        private String status;
    }
}
