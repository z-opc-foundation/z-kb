package com.zifang.z.kb.resource;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.ConfigDiff;
import com.zifang.z.kb.api.resource.ConfigImpact;
import com.zifang.z.kb.api.resource.ConfigIssue;
import com.zifang.z.kb.api.resource.ConfigValidation;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigView;
import com.zifang.z.kb.api.resource.KnowledgeBaseProfileVersion;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.ProfileVersionStatus;
import com.zifang.z.kb.storage.resource.entity.KnowledgeBaseProfileEntity;
import com.zifang.z.kb.storage.resource.entity.KnowledgeBaseProfileVersionEntity;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileVersionMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 配置版本默认实现：草稿 → 校验 → 发布，发布时同步配置档案主表。
 */
public class DefaultKnowledgeBaseConfigService implements KnowledgeBaseConfigService {

    private static final int MAX_POLICY_LENGTH = 2000;
    private static final int MAX_PRESET_LENGTH = 32;
    private static final int MAX_REMARK_LENGTH = 500;
    private static final String EMPTY_POLICY = "{}";
    private static final String FULL = "FULL";
    private static final String INCREMENTAL = "INCREMENTAL";
    private static final String NONE = "NONE";

    /** 参与差异比较与校验的字段（与参考实现一致：不含 sourcePolicy）。 */
    private static final List<String> FIELDS = Arrays.asList(
            "presetVersion", "parserPolicy", "chunkingPolicy", "extractionPolicy",
            "wikiPolicy", "graphPolicy", "reviewPolicy", "freshnessPolicy", "retrievalPolicy");

    private final KnowledgeBaseResourceService resourceService;
    private final KnowledgeBaseProfileMapper profileMapper;
    private final KnowledgeBaseProfileVersionMapper versionMapper;
    private final KbAuditService auditService;

    public DefaultKnowledgeBaseConfigService(KnowledgeBaseResourceService resourceService,
                                             KnowledgeBaseProfileMapper profileMapper,
                                             KnowledgeBaseProfileVersionMapper versionMapper,
                                             KbAuditService auditService) {
        this.resourceService = resourceService;
        this.profileMapper = profileMapper;
        this.versionMapper = versionMapper;
        this.auditService = auditService;
    }

    @Override
    public KnowledgeBaseConfigView query(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireReadable(kbId, caller);
        ensureCurrentVersion(kb, caller);
        KnowledgeBaseProfileVersionEntity current = selectVersion(kb, ProfileVersionStatus.CURRENT);
        KnowledgeBaseProfileVersionEntity draft = selectVersion(kb, ProfileVersionStatus.DRAFT);
        List<ConfigDiff> diff = draft == null ? new ArrayList<>() : buildDiff(current, draft);

        KnowledgeBaseConfigView view = new KnowledgeBaseConfigView();
        view.setKbId(kb.getKbId());
        view.setKbName(kb.getName());
        view.setType(kb.getType());
        view.setEmbeddingModel(kb.getEmbeddingModel());
        view.setCanManage(kb.isCanManage());
        view.setCurrent(toModel(current));
        view.setDraft(draft == null ? null : toModel(draft));
        List<KnowledgeBaseProfileVersion> versions = new ArrayList<>();
        for (KnowledgeBaseProfileVersionEntity row : listVersions(kb)) {
            if (!ProfileVersionStatus.DRAFT.name().equals(row.getStatus())) {
                versions.add(toModel(row));
            }
        }
        view.setVersions(versions);
        view.setDiff(diff);
        view.setImpact(buildImpact(diff));
        view.setValidation(buildValidation(draft, diff));
        return view;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseProfileVersion saveDraft(String kbId, KnowledgeBaseProfileVersion draft,
                                                 KbCaller caller) {
        if (draft == null) {
            throw new KBException("KB_CONFIG_DRAFT_INVALID", "配置草稿不能为空");
        }
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.KB_MANAGE, caller);
        ensureCurrentVersion(kb, caller);

        String preset = requirePreset(draft.getPresetVersion());
        String parser = requirePolicy(draft.getParserPolicy(), "解析策略");
        String chunking = requirePolicy(draft.getChunkingPolicy(), "切块策略");
        String extraction = requirePolicy(draft.getExtractionPolicy(), "抽取策略");
        String wiki = requirePolicy(draft.getWikiPolicy(), "编页策略");
        String graph = requirePolicy(draft.getGraphPolicy(), "图谱策略");
        String review = requirePolicy(draft.getReviewPolicy(), "审核策略");
        String freshness = requirePolicy(draft.getFreshnessPolicy(), "时效策略");
        String retrieval = requirePolicy(draft.getRetrievalPolicy(), "检索策略");
        String source = requirePolicy(draft.getSourcePolicy(), "接入策略");

        Instant now = Instant.now();
        KnowledgeBaseProfileVersionEntity entity = selectVersion(kb, ProfileVersionStatus.DRAFT);
        boolean created = false;
        if (entity == null) {
            created = true;
            entity = new KnowledgeBaseProfileVersionEntity();
            entity.setId(UUID.randomUUID().toString());
            entity.setKbId(kb.getKbId());
            entity.setTenantCode(kb.getTenantCode());
            entity.setVersionNo(nextVersionNo(kb));
            entity.setStatus(ProfileVersionStatus.DRAFT.name());
            entity.setCreateBy(caller.getActorId());
            entity.setCreateTime(now);
        }
        entity.setPresetVersion(preset);
        entity.setParserPolicy(parser);
        entity.setChunkingPolicy(chunking);
        entity.setExtractionPolicy(extraction);
        entity.setWikiPolicy(wiki);
        entity.setGraphPolicy(graph);
        entity.setReviewPolicy(review);
        entity.setFreshnessPolicy(freshness);
        entity.setRetrievalPolicy(retrieval);
        entity.setSourcePolicy(source);
        if (draft.getRemark() != null && !draft.getRemark().trim().isEmpty()) {
            entity.setRemark(truncate(draft.getRemark().trim(), MAX_REMARK_LENGTH));
        }
        entity.setUpdateBy(caller.getActorId());
        entity.setUpdateTime(now);
        if (created) {
            versionMapper.insert(entity);
        } else {
            versionMapper.updateById(entity);
        }
        auditService.record(caller, kb.getKbId(), "kb.config.draft.save", "PROFILE_VERSION",
                entity.getId(), "保存配置草稿 v" + entity.getVersionNo());
        return toModel(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean discardDraft(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.KB_MANAGE, caller);
        versionMapper.delete(new QueryWrapper<KnowledgeBaseProfileVersionEntity>()
                .eq("tenant_code", kb.getTenantCode())
                .eq("kb_id", kb.getKbId())
                .eq("status", ProfileVersionStatus.DRAFT.name()));
        auditService.record(caller, kb.getKbId(), "kb.config.draft.discard", "KNOWLEDGE_BASE",
                kb.getKbId(), "丢弃配置草稿");
        return true;
    }

    @Override
    public ConfigValidation validateDraft(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireReadable(kbId, caller);
        ensureCurrentVersion(kb, caller);
        KnowledgeBaseProfileVersionEntity current = selectVersion(kb, ProfileVersionStatus.CURRENT);
        KnowledgeBaseProfileVersionEntity draft = selectVersion(kb, ProfileVersionStatus.DRAFT);
        List<ConfigDiff> diff = draft == null ? new ArrayList<>() : buildDiff(current, draft);
        return buildValidation(draft, diff);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseProfileVersion publish(String kbId, String remark, boolean confirm,
                                               KbCaller caller) {
        if (!confirm) {
            throw new KBException("KB_CONFIG_CONFIRM_REQUIRED", "发布配置需要确认");
        }
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.KB_MANAGE, caller);
        ensureCurrentVersion(kb, caller);
        KnowledgeBaseProfileVersionEntity current = selectVersion(kb, ProfileVersionStatus.CURRENT);
        KnowledgeBaseProfileVersionEntity draft = selectVersion(kb, ProfileVersionStatus.DRAFT);
        if (draft == null) {
            throw new KBException("KB_CONFIG_DRAFT_NOT_FOUND", "没有可发布的配置草稿");
        }
        ConfigValidation validation = buildValidation(draft, buildDiff(current, draft));
        if (!validation.isValid()) {
            throw new KBException("KB_CONFIG_DRAFT_INVALID", "配置草稿校验未通过，不能发布");
        }
        KnowledgeBaseProfileEntity profile = selectProfile(kb);
        if (profile == null) {
            throw new KBException("KB_NOT_FOUND", "知识库配置档案不存在");
        }

        Instant now = Instant.now();
        UpdateWrapper<KnowledgeBaseProfileVersionEntity> supersede = new UpdateWrapper<>();
        supersede.eq("tenant_code", kb.getTenantCode())
                .eq("kb_id", kb.getKbId())
                .eq("status", ProfileVersionStatus.CURRENT.name())
                .set("status", ProfileVersionStatus.SUPERSEDED.name())
                .set("update_by", caller.getActorId())
                .set("update_time", now);
        versionMapper.update(null, supersede);

        draft.setStatus(ProfileVersionStatus.CURRENT.name());
        draft.setPublishedBy(caller.getActorId());
        draft.setPublishedAt(now);
        if (remark != null && !remark.trim().isEmpty()) {
            draft.setRemark(truncate(remark.trim(), MAX_REMARK_LENGTH));
        }
        draft.setUpdateBy(caller.getActorId());
        draft.setUpdateTime(now);
        versionMapper.updateById(draft);

        profile.setPresetVersion(draft.getPresetVersion());
        profile.setParserPolicy(draft.getParserPolicy());
        profile.setChunkingPolicy(draft.getChunkingPolicy());
        profile.setExtractionPolicy(draft.getExtractionPolicy());
        profile.setWikiPolicy(draft.getWikiPolicy());
        profile.setGraphPolicy(draft.getGraphPolicy());
        profile.setReviewPolicy(draft.getReviewPolicy());
        profile.setFreshnessPolicy(draft.getFreshnessPolicy());
        profile.setRetrievalPolicy(draft.getRetrievalPolicy());
        profile.setSourcePolicy(draft.getSourcePolicy());
        profile.setConfigVersion(draft.getVersionNo());
        profile.setUpdateBy(caller.getActorId());
        profile.setUpdateTime(now);
        profileMapper.updateById(profile);

        auditService.record(caller, kb.getKbId(), "kb.config.publish", "PROFILE_VERSION",
                draft.getId(), "发布配置 v" + draft.getVersionNo());
        return toModel(draft);
    }

    // ==================== 内部工具 ====================

    /** 缺失当前版本时，以配置档案主表补建初始当前版本。 */
    private void ensureCurrentVersion(KnowledgeBaseView kb, KbCaller caller) {
        if (selectVersion(kb, ProfileVersionStatus.CURRENT) != null) {
            return;
        }
        KnowledgeBaseProfileEntity profile = selectProfile(kb);
        if (profile == null) {
            throw new KBException("KB_NOT_FOUND", "知识库配置档案不存在");
        }
        Instant now = Instant.now();
        Instant publishedAt = profile.getCreateTime() == null ? now : profile.getCreateTime();
        KnowledgeBaseProfileVersionEntity entity = new KnowledgeBaseProfileVersionEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setKbId(kb.getKbId());
        entity.setTenantCode(kb.getTenantCode());
        entity.setVersionNo(parseVersion(profile.getConfigVersion()));
        entity.setStatus(ProfileVersionStatus.CURRENT.name());
        entity.setPresetVersion(profile.getPresetVersion());
        entity.setParserPolicy(profile.getParserPolicy());
        entity.setChunkingPolicy(profile.getChunkingPolicy());
        entity.setExtractionPolicy(profile.getExtractionPolicy());
        entity.setWikiPolicy(profile.getWikiPolicy());
        entity.setGraphPolicy(profile.getGraphPolicy());
        entity.setReviewPolicy(profile.getReviewPolicy());
        entity.setFreshnessPolicy(profile.getFreshnessPolicy());
        entity.setRetrievalPolicy(profile.getRetrievalPolicy());
        entity.setSourcePolicy(profile.getSourcePolicy());
        entity.setRemark("初始配置");
        entity.setPublishedBy(profile.getCreateBy() == null ? caller.getActorId()
                : profile.getCreateBy());
        entity.setPublishedAt(publishedAt);
        entity.setCreateBy(caller.getActorId());
        entity.setUpdateBy(caller.getActorId());
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        try {
            versionMapper.insert(entity);
        } catch (RuntimeException e) {
            // 并发补建撞唯一键：以先落库的那条为准
            if (selectVersion(kb, ProfileVersionStatus.CURRENT) == null) {
                throw e;
            }
        }
    }

    private int parseVersion(Integer configVersion) {
        return configVersion == null || configVersion < 1 ? 1 : configVersion;
    }

    private int nextVersionNo(KnowledgeBaseView kb) {
        int max = 0;
        for (KnowledgeBaseProfileVersionEntity row : listVersions(kb)) {
            if (row.getVersionNo() != null && row.getVersionNo() > max) {
                max = row.getVersionNo();
            }
        }
        return max + 1;
    }

    private KnowledgeBaseProfileEntity selectProfile(KnowledgeBaseView kb) {
        QueryWrapper<KnowledgeBaseProfileEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", kb.getTenantCode()).eq("kb_id", kb.getKbId());
        return profileMapper.selectOne(query);
    }

    private KnowledgeBaseProfileVersionEntity selectVersion(KnowledgeBaseView kb,
                                                            ProfileVersionStatus status) {
        QueryWrapper<KnowledgeBaseProfileVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", kb.getTenantCode())
                .eq("kb_id", kb.getKbId())
                .eq("status", status.name());
        return versionMapper.selectOne(query);
    }

    private List<KnowledgeBaseProfileVersionEntity> listVersions(KnowledgeBaseView kb) {
        QueryWrapper<KnowledgeBaseProfileVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", kb.getTenantCode())
                .eq("kb_id", kb.getKbId())
                .orderByDesc("version_no");
        return versionMapper.selectList(query);
    }

    private KnowledgeBaseProfileVersion toModel(KnowledgeBaseProfileVersionEntity row) {
        if (row == null) {
            return null;
        }
        KnowledgeBaseProfileVersion model = new KnowledgeBaseProfileVersion();
        model.setVersionId(row.getId());
        model.setKbId(row.getKbId());
        model.setTenantCode(row.getTenantCode());
        model.setVersionNo(row.getVersionNo() == null ? 0 : row.getVersionNo());
        model.setStatus(ProfileVersionStatus.valueOf(row.getStatus()));
        model.setPresetVersion(row.getPresetVersion());
        model.setParserPolicy(KbResourceJson.parseObject(row.getParserPolicy()));
        model.setChunkingPolicy(KbResourceJson.parseObject(row.getChunkingPolicy()));
        model.setExtractionPolicy(KbResourceJson.parseObject(row.getExtractionPolicy()));
        model.setWikiPolicy(KbResourceJson.parseObject(row.getWikiPolicy()));
        model.setGraphPolicy(KbResourceJson.parseObject(row.getGraphPolicy()));
        model.setReviewPolicy(KbResourceJson.parseObject(row.getReviewPolicy()));
        model.setFreshnessPolicy(KbResourceJson.parseObject(row.getFreshnessPolicy()));
        model.setRetrievalPolicy(KbResourceJson.parseObject(row.getRetrievalPolicy()));
        model.setSourcePolicy(KbResourceJson.parseObject(row.getSourcePolicy()));
        model.setRemark(row.getRemark());
        model.setPublishedBy(row.getPublishedBy());
        model.setPublishedAt(row.getPublishedAt());
        model.setCreatedAt(row.getCreateTime());
        return model;
    }

    private List<ConfigDiff> buildDiff(KnowledgeBaseProfileVersionEntity current,
                                       KnowledgeBaseProfileVersionEntity draft) {
        List<ConfigDiff> diff = new ArrayList<>();
        for (String field : FIELDS) {
            String before = valueOf(current, field);
            String after = valueOf(draft, field);
            if (before.equals(after)) {
                continue;
            }
            String scope = scopeOf(field);
            diff.add(new ConfigDiff(field, labelOf(field), scope, before, after, scope));
        }
        return diff;
    }

    private ConfigImpact buildImpact(List<ConfigDiff> diff) {
        boolean full = false;
        boolean incremental = false;
        for (ConfigDiff item : diff) {
            if (FULL.equals(item.getScope())) {
                full = true;
            } else if (INCREMENTAL.equals(item.getScope())) {
                incremental = true;
            }
        }
        ConfigImpact impact = new ConfigImpact();
        List<String> notes = new ArrayList<>();
        if (diff.isEmpty()) {
            impact.setRebuildMode(NONE);
            notes.add("草稿与当前版本一致，没有需要重建的变更");
        } else if (full) {
            impact.setRebuildMode(FULL);
            notes.add("预设、解析或切块变化会改变全部物料产物，需要全量重建");
        } else if (incremental) {
            impact.setRebuildMode(INCREMENTAL);
            notes.add("抽取、编页或图谱变化可复用已解析文本，按已解析物料增量重建");
        } else {
            impact.setRebuildMode(NONE);
            notes.add("仅流程或检索参数变化，发布后立即生效，无需重建产物");
        }
        for (ConfigDiff item : diff) {
            if ("retrievalPolicy".equals(item.getField())) {
                notes.add("检索策略在发布后对线上问答立即生效");
                break;
            }
        }
        notes.add("库内暂无物料，重建影响为 0");
        impact.setNotes(notes);
        return impact;
    }

    private ConfigValidation buildValidation(KnowledgeBaseProfileVersionEntity draft,
                                             List<ConfigDiff> diff) {
        ConfigValidation validation = new ConfigValidation();
        validation.setChangedCount(diff.size());
        List<ConfigIssue> items = new ArrayList<>();
        if (draft == null) {
            items.add(new ConfigIssue("draft", "草稿存在", false, "尚未保存配置草稿"));
            validation.setItems(items);
            validation.setValid(false);
            return validation;
        }
        boolean presetOk = hasText(draft.getPresetVersion())
                && draft.getPresetVersion().length() <= MAX_PRESET_LENGTH;
        items.add(new ConfigIssue("preset", "预设版本", presetOk,
                presetOk ? draft.getPresetVersion() : "预设版本不能为空且不超过 32 个字符"));

        List<String> badPolicies = new ArrayList<>();
        for (String field : FIELDS) {
            if ("presetVersion".equals(field)) {
                continue;
            }
            String value = valueOf(draft, field);
            if (value.length() > MAX_POLICY_LENGTH || !KbResourceJson.isJsonObject(value)) {
                badPolicies.add(labelOf(field));
            }
        }
        items.add(new ConfigIssue("policy", "策略 JSON", badPolicies.isEmpty(),
                badPolicies.isEmpty() ? "8 项策略均为 JSON 对象"
                        : "以下策略不是合法 JSON 对象：" + String.join("、", badPolicies)));

        boolean remarkOk = draft.getRemark() == null
                || draft.getRemark().length() <= MAX_REMARK_LENGTH;
        items.add(new ConfigIssue("remark", "发布说明", remarkOk,
                remarkOk ? "发布说明长度合规" : "发布说明不超过 500 个字符"));

        boolean changed = !diff.isEmpty();
        items.add(new ConfigIssue("change", "存在可发布变更", changed,
                changed ? "检测到 " + diff.size() + " 项变更" : "未检测到变更，无需发布"));

        boolean valid = true;
        for (ConfigIssue item : items) {
            if (!item.isOk()) {
                valid = false;
                break;
            }
        }
        validation.setItems(items);
        validation.setValid(valid);
        return validation;
    }

    private String valueOf(KnowledgeBaseProfileVersionEntity row, String field) {
        if (row == null) {
            return EMPTY_POLICY;
        }
        switch (field) {
            case "presetVersion":
                return row.getPresetVersion() == null ? "" : row.getPresetVersion();
            case "parserPolicy":
                return KbResourceJson.normalize(row.getParserPolicy());
            case "chunkingPolicy":
                return KbResourceJson.normalize(row.getChunkingPolicy());
            case "extractionPolicy":
                return KbResourceJson.normalize(row.getExtractionPolicy());
            case "wikiPolicy":
                return KbResourceJson.normalize(row.getWikiPolicy());
            case "graphPolicy":
                return KbResourceJson.normalize(row.getGraphPolicy());
            case "reviewPolicy":
                return KbResourceJson.normalize(row.getReviewPolicy());
            case "freshnessPolicy":
                return KbResourceJson.normalize(row.getFreshnessPolicy());
            case "retrievalPolicy":
                return KbResourceJson.normalize(row.getRetrievalPolicy());
            default:
                return "";
        }
    }

    private String labelOf(String field) {
        switch (field) {
            case "presetVersion":
                return "预设版本";
            case "parserPolicy":
                return "解析策略";
            case "chunkingPolicy":
                return "切块策略";
            case "extractionPolicy":
                return "抽取策略";
            case "wikiPolicy":
                return "编页策略";
            case "graphPolicy":
                return "图谱策略";
            case "reviewPolicy":
                return "审核策略";
            case "freshnessPolicy":
                return "时效策略";
            case "retrievalPolicy":
                return "检索策略";
            default:
                return field;
        }
    }

    private String scopeOf(String field) {
        switch (field) {
            case "presetVersion":
            case "parserPolicy":
            case "chunkingPolicy":
                return FULL;
            case "extractionPolicy":
            case "wikiPolicy":
            case "graphPolicy":
                return INCREMENTAL;
            default:
                return NONE;
        }
    }

    private String requirePreset(String value) {
        if (!hasText(value)) {
            throw new KBException("KB_CONFIG_DRAFT_INVALID", "预设版本不能为空");
        }
        String preset = value.trim();
        if (preset.length() > MAX_PRESET_LENGTH) {
            throw new KBException("KB_CONFIG_DRAFT_INVALID", "预设版本不超过 32 个字符");
        }
        return preset;
    }

    private String requirePolicy(Map<String, Object> policy, String label) {
        String json = KbResourceJson.writeObject(policy == null ? new LinkedHashMap<>() : policy);
        if (json.length() > MAX_POLICY_LENGTH || !KbResourceJson.isJsonObject(json)) {
            throw new KBException("KB_CONFIG_DRAFT_INVALID", label + "必须是合法 JSON 对象");
        }
        return json;
    }

    private String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
