package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.concept.ConceptDetailView;
import com.zifang.z.kb.api.concept.ConceptMentionView;
import com.zifang.z.kb.api.concept.ConceptService;
import com.zifang.z.kb.api.concept.ConceptView;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.storage.extraction.entity.ConceptEntity;
import com.zifang.z.kb.storage.extraction.entity.ConceptMentionEntity;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMapper;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMentionMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * 概念模型查询默认实现：概念由编译萃取涌现，读写都限定在租户 + 知识库内。
 */
public class DefaultConceptService implements ConceptService {

    private static final int MAX_LIST = 200;

    private static final int MAX_MENTIONS = 100;

    private final ConceptMapper conceptMapper;

    private final ConceptMentionMapper mentionMapper;

    private final KnowledgeBaseResourceService resourceService;

    public DefaultConceptService(ConceptMapper conceptMapper,
                                 ConceptMentionMapper mentionMapper,
                                 KnowledgeBaseResourceService resourceService) {
        this.conceptMapper = conceptMapper;
        this.mentionMapper = mentionMapper;
        this.resourceService = resourceService;
    }

    @Override
    public List<ConceptView> listByKb(String kbId, String keyword, KbCaller caller) {
        String kb = requireKb(kbId, caller);
        QueryWrapper<ConceptEntity> query = new QueryWrapper<ConceptEntity>()
                .eq("tenant_code", caller.getTenantCode())
                .eq("kb_id", kb)
                .eq("is_deleted", 0);
        if (keyword != null && !keyword.trim().isEmpty()) {
            query.like("name", keyword.trim());
        }
        query.orderByDesc("material_count").orderByDesc("mention_count").orderByAsc("name")
                .last("LIMIT " + MAX_LIST);
        List<ConceptView> result = new ArrayList<>();
        for (ConceptEntity concept : conceptMapper.selectList(query)) {
            result.add(toView(concept));
        }
        return result;
    }

    @Override
    public ConceptDetailView queryById(String kbId, String conceptId, KbCaller caller) {
        String kb = requireKb(kbId, caller);
        if (conceptId == null || conceptId.trim().isEmpty()) {
            throw new KBException("KB_PARAM_INVALID", "知识库参数不合法");
        }
        ConceptEntity concept = findByConceptId(caller.getTenantCode(), kb, conceptId.trim());
        if (concept == null) {
            throw new KBException("KB_CONCEPT_NOT_FOUND", "概念不存在");
        }
        ConceptDetailView detail = new ConceptDetailView();
        detail.setConcept(toView(concept));
        QueryWrapper<ConceptMentionEntity> query = new QueryWrapper<ConceptMentionEntity>()
                .eq("tenant_code", caller.getTenantCode())
                .eq("kb_id", kb)
                .eq("concept_id", concept.getConceptId())
                .eq("is_deleted", 0)
                .orderByDesc("create_time").orderByDesc("id")
                .last("LIMIT " + MAX_MENTIONS);
        for (ConceptMentionEntity mention : mentionMapper.selectList(query)) {
            detail.getMentions().add(toMentionView(mention));
        }
        return detail;
    }

    private String requireKb(String kbId, KbCaller caller) {
        if (kbId == null || kbId.trim().isEmpty()) {
            throw new KBException("KB_PARAM_INVALID", "知识库参数不合法");
        }
        return resourceService.requireReadable(kbId.trim(), caller).getKbId();
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

    private ConceptView toView(ConceptEntity concept) {
        ConceptView view = new ConceptView();
        view.setConceptId(concept.getConceptId());
        view.setName(concept.getName());
        view.setConceptType(concept.getConceptType());
        view.setStatus(concept.getStatus());
        view.setDefinition(concept.getDefinition());
        view.setMentionCount(concept.getMentionCount() == null ? 0 : concept.getMentionCount());
        view.setMaterialCount(concept.getMaterialCount() == null ? 0 : concept.getMaterialCount());
        view.setFirstMaterialId(concept.getFirstMaterialId());
        view.setLastMaterialId(concept.getLastMaterialId());
        view.setGraphNodeId("concept:" + concept.getConceptId());
        view.setEvidence(concept.getEvidenceJson());
        return view;
    }

    private ConceptMentionView toMentionView(ConceptMentionEntity mention) {
        ConceptMentionView view = new ConceptMentionView();
        view.setMentionId(mention.getMentionId());
        view.setConceptId(mention.getConceptId());
        view.setMaterialId(mention.getMaterialId());
        view.setMaterialTitle(mention.getMaterialTitle());
        view.setMaterialVersionId(mention.getMaterialVersionId());
        view.setExtractionItemId(mention.getExtractionItemId());
        view.setChunkOrdinal(mention.getChunkOrdinal() == null ? 0 : mention.getChunkOrdinal());
        view.setOccurrenceCount(mention.getOccurrenceCount() == null
                ? 1 : mention.getOccurrenceCount());
        view.setEvidence(mention.getEvidenceJson());
        return view;
    }
}
