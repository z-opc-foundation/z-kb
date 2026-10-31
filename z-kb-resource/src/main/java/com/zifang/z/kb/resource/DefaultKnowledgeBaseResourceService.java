package com.zifang.z.***REMOVED***.resource;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBase;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAcl;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseQuery;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseRole;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseStatus;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseType;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.api.resource.PrincipalType;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseAclEntity;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseEntity;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseProfileEntity;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseProfileVersionEntity;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseAclMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileVersionMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 知识库资源服务默认实现：租户内按「所有者或有效 ACL」划定可见范围。
 */
public class DefaultKnowledgeBaseResourceService implements KnowledgeBaseResourceService {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_-]{2,63}$");
    private static final int MAX_NAME_LENGTH = 100;
    private static final int MAX_DESCRIPTION_LENGTH = 500;
    private static final int MAX_EMBEDDING_MODEL_LENGTH = 64;
    private static final long DEFAULT_PAGE_SIZE = 10;
    private static final long MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_EMBEDDING_MODEL = "tfidf";
    private static final String DEFAULT_PRESET_VERSION = "default";
    private static final String EMPTY_POLICY = "{}";
    private static final String EMPTY_SOURCE_POLICY = "{\"version\":1,\"sources\":[]}";
    private static final int INITIAL_CONFIG_VERSION = 1;

    private final KnowledgeBaseMapper ***REMOVED***Mapper;
    private final KnowledgeBaseAclMapper aclMapper;
    private final KnowledgeBaseProfileMapper profileMapper;
    private final KnowledgeBaseProfileVersionMapper versionMapper;
    private final ***REMOVED***AuditService auditService;

    public DefaultKnowledgeBaseResourceService(KnowledgeBaseMapper ***REMOVED***Mapper,
                                               KnowledgeBaseAclMapper aclMapper,
                                               KnowledgeBaseProfileMapper profileMapper,
                                               KnowledgeBaseProfileVersionMapper versionMapper,
                                               ***REMOVED***AuditService auditService) {
        this.***REMOVED***Mapper = ***REMOVED***Mapper;
        this.aclMapper = aclMapper;
        this.profileMapper = profileMapper;
        this.versionMapper = versionMapper;
        this.auditService = auditService;
    }

    @Override
    public PageResult<KnowledgeBaseView> page(KnowledgeBaseQuery query, ***REMOVED***Caller caller) {
        requireTenant(caller);
        KnowledgeBaseQuery q = query == null ? new KnowledgeBaseQuery() : query;
        long current = q.getCurrent() < 1 ? 1 : q.getCurrent();
        long size = q.getSize() < 1 ? DEFAULT_PAGE_SIZE : Math.min(q.getSize(), MAX_PAGE_SIZE);

        Map<String, String> roles = rolesOf(caller);
        List<String> granted = new ArrayList<>(roles.keySet());

        QueryWrapper<KnowledgeBaseEntity> base = new QueryWrapper<>();
        base.eq("tenant_code", caller.getTenantCode());
        String type = hasText(q.getType()) ? parseType(q.getType()).name() : null;
        if (type != null) {
            base.eq("type", type);
        }
        if (hasText(q.getStatus())) {
            base.eq("status", parseStatus(q.getStatus()).name());
        } else if (!q.isIncludeArchived()) {
            base.eq("status", KnowledgeBaseStatus.ACTIVE.name());
        } else {
            base.ne("status", KnowledgeBaseStatus.DELETING.name());
        }
        if (hasText(q.getKeyword())) {
            String keyword = q.getKeyword().trim();
            base.and(w -> w.like("name", keyword).or().like("code", keyword));
        }
        String actorId = caller.getActorId();
        base.and(w -> {
            w.eq("owner_id", actorId);
            if (!granted.isEmpty()) {
                w.or().in("***REMOVED***_id", granted);
            }
        });

        Long total = ***REMOVED***Mapper.selectCount(base.clone());
        QueryWrapper<KnowledgeBaseEntity> listQuery = base.clone()
                .orderByDesc("create_time")
                .last("LIMIT " + size + " OFFSET " + ((current - 1) * size));
        List<KnowledgeBaseView> views = new ArrayList<>();
        for (KnowledgeBaseEntity entity : ***REMOVED***Mapper.selectList(listQuery)) {
            views.add(toView(entity, roleOf(entity, caller, roles)));
        }
        return new PageResult<>(views, total == null ? 0 : total, current, size);
    }

    @Override
    public KnowledgeBaseView detail(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        return requireReadable(***REMOVED***Id, caller);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseView create(KnowledgeBase input, ***REMOVED***Caller caller) {
        requireTenant(caller);
        if (input == null) {
            throw ***REMOVED***Exception.badRequest("知识库创建参数不能为空");
        }
        String name = requireName(input.getName());
        String code = requireCode(input.getCode());
        KnowledgeBaseType type = requireType(input.getType());
        String description = requireDescription(input.getDescription());
        String embeddingModel = normalizeEmbeddingModel(input.getEmbeddingModel());

        QueryWrapper<KnowledgeBaseEntity> duplicate = new QueryWrapper<>();
        duplicate.eq("tenant_code", caller.getTenantCode()).eq("code", code);
        Long exists = ***REMOVED***Mapper.selectCount(duplicate);
        if (exists != null && exists > 0) {
            throw new ***REMOVED***Exception("***REMOVED***CODE_DUPLICATE", "知识库编码已存在：" + code);
        }

        Instant now = Instant.now();
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.set***REMOVED***Id(UUID.randomUUID().toString());
        entity.setTenantCode(caller.getTenantCode());
        entity.setName(name);
        entity.setCode(code);
        entity.setType(type.name());
        entity.setDescription(description);
        entity.setOwnerId(caller.getActorId());
        entity.setStatus(KnowledgeBaseStatus.ACTIVE.name());
        entity.setEmbeddingModel(embeddingModel);
        entity.setCreateBy(caller.getActorId());
        entity.setUpdateBy(caller.getActorId());
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        try {
            ***REMOVED***Mapper.insert(entity);
        } catch (RuntimeException e) {
            throw new ***REMOVED***Exception("***REMOVED***CODE_DUPLICATE", "知识库编码已存在：" + code, e);
        }

        profileMapper.insert(buildInitialProfile(entity, caller, now));
        aclMapper.insert(buildOwnerAcl(entity, caller, now));
        auditService.record(caller, entity.get***REMOVED***Id(), "***REMOVED***.create", "KNOWLEDGE_BASE",
                entity.get***REMOVED***Id(), "创建知识库 " + code);
        return toView(entity, KnowledgeBaseRole.***REMOVED***ADMIN.name());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseView update(String ***REMOVED***Id, String name, String description, ***REMOVED***Caller caller) {
        KnowledgeBaseView existing = requireActionable(***REMOVED***Id, KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        String safeName = requireName(name);
        String safeDescription = requireDescription(description);
        UpdateWrapper<KnowledgeBaseEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", caller.getTenantCode())
                .eq("***REMOVED***_id", existing.get***REMOVED***Id())
                .eq("status", KnowledgeBaseStatus.ACTIVE.name())
                .set("name", safeName)
                .set("description", safeDescription)
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        int rows = ***REMOVED***Mapper.update(null, update);
        if (rows == 0) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "只有生效中的知识库可以更新");
        }
        auditService.record(caller, existing.get***REMOVED***Id(), "***REMOVED***.update", "KNOWLEDGE_BASE",
                existing.get***REMOVED***Id(), "更新知识库信息");
        return detail(existing.get***REMOVED***Id(), caller);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean archive(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView existing = requireActionable(***REMOVED***Id, KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        UpdateWrapper<KnowledgeBaseEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", caller.getTenantCode())
                .eq("***REMOVED***_id", existing.get***REMOVED***Id())
                .eq("status", KnowledgeBaseStatus.ACTIVE.name())
                .set("status", KnowledgeBaseStatus.ARCHIVED.name())
                .set("archived_at", Instant.now())
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        int rows = ***REMOVED***Mapper.update(null, update);
        if (rows == 0) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "只有生效中的知识库可以归档");
        }
        auditService.record(caller, existing.get***REMOVED***Id(), "***REMOVED***.archive", "KNOWLEDGE_BASE",
                existing.get***REMOVED***Id(), "归档知识库");
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean restore(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView existing = requireActionable(***REMOVED***Id, KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        UpdateWrapper<KnowledgeBaseEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", caller.getTenantCode())
                .eq("***REMOVED***_id", existing.get***REMOVED***Id())
                .eq("status", KnowledgeBaseStatus.ARCHIVED.name())
                .set("status", KnowledgeBaseStatus.ACTIVE.name())
                .set("archived_at", null)
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        int rows = ***REMOVED***Mapper.update(null, update);
        if (rows == 0) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "只有已归档的知识库可以恢复");
        }
        auditService.record(caller, existing.get***REMOVED***Id(), "***REMOVED***.restore", "KNOWLEDGE_BASE",
                existing.get***REMOVED***Id(), "恢复知识库");
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean remove(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView existing = requireActionable(***REMOVED***Id, KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        if (!KnowledgeBaseStatus.ARCHIVED.name().equals(existing.getStatus().name())) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "只有已归档的知识库可以删除");
        }
        String tenant = caller.getTenantCode();
        String id = existing.get***REMOVED***Id();
        profileMapper.delete(new QueryWrapper<KnowledgeBaseProfileEntity>()
                .eq("tenant_code", tenant).eq("***REMOVED***_id", id));
        versionMapper.delete(new QueryWrapper<KnowledgeBaseProfileVersionEntity>()
                .eq("tenant_code", tenant).eq("***REMOVED***_id", id));
        aclMapper.delete(new QueryWrapper<KnowledgeBaseAclEntity>()
                .eq("tenant_code", tenant).eq("***REMOVED***_id", id));
        int rows = ***REMOVED***Mapper.delete(new QueryWrapper<KnowledgeBaseEntity>()
                .eq("tenant_code", tenant).eq("***REMOVED***_id", id)
                .eq("status", KnowledgeBaseStatus.ARCHIVED.name()));
        if (rows == 0) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "知识库删除失败，请重试");
        }
        auditService.record(caller, null, "***REMOVED***.remove", "KNOWLEDGE_BASE", id,
                "删除知识库 " + existing.getCode());
        return true;
    }

    @Override
    public Map<String, List<KnowledgeBaseActivityPoint>> heatmap(List<String> ***REMOVED***Ids, int days,
                                                                 ***REMOVED***Caller caller) {
        requireTenant(caller);
        List<String> readable = readable***REMOVED***Ids(***REMOVED***Ids, caller);
        return auditService.heatmap(caller.getTenantCode(), readable, days);
    }

    @Override
    public KnowledgeBaseView requireReadable(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        requireTenant(caller);
        if (!hasText(***REMOVED***Id)) {
            throw new ***REMOVED***Exception("***REMOVED***NOT_FOUND", "知识库不存在或已删除");
        }
        KnowledgeBaseEntity entity = selectBy***REMOVED***Id(caller.getTenantCode(), ***REMOVED***Id.trim());
        if (entity == null) {
            throw new ***REMOVED***Exception("***REMOVED***NOT_FOUND", "知识库不存在或已删除：" + ***REMOVED***Id);
        }
        String role = roleOf(entity, caller, null);
        if (role == null) {
            throw ***REMOVED***Exception.forbidden("无权访问该知识库");
        }
        return toView(entity, role);
    }

    @Override
    public KnowledgeBaseView requireActionable(String ***REMOVED***Id, KnowledgeBaseAction action,
                                               ***REMOVED***Caller caller) {
        KnowledgeBaseView view = requireReadable(***REMOVED***Id, caller);
        if (!KnowledgeBaseRoleActions.can(view.getRole(), action)) {
            throw new ***REMOVED***Exception("***REMOVED***ACTION_FORBIDDEN",
                    "当前角色无权执行该操作：" + (action == null ? "" : action.getCode()));
        }
        return view;
    }

    // ==================== 内部工具 ====================

    private KnowledgeBaseEntity selectBy***REMOVED***Id(String tenantCode, String ***REMOVED***Id) {
        QueryWrapper<KnowledgeBaseEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode).eq("***REMOVED***_id", ***REMOVED***Id);
        return ***REMOVED***Mapper.selectOne(query);
    }

    /** 当前调用者在租户内全部有效授权的 ***REMOVED***Id → 角色。 */
    private Map<String, String> rolesOf(***REMOVED***Caller caller) {
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode())
                .eq("principal_id", caller.getActorId())
                .eq("principal_type", PrincipalType.USER.name());
        Map<String, String> roles = new LinkedHashMap<>();
        Instant now = Instant.now();
        for (KnowledgeBaseAclEntity acl : aclMapper.selectList(query)) {
            if (acl.getExpiresAt() == null || acl.getExpiresAt().isAfter(now)) {
                roles.put(acl.get***REMOVED***Id(), acl.getRole());
            }
        }
        return roles;
    }

    private String roleOf(KnowledgeBaseEntity entity, ***REMOVED***Caller caller, Map<String, String> cached) {
        if (caller.isSameActor(entity.getOwnerId())) {
            return KnowledgeBaseRole.***REMOVED***ADMIN.name();
        }
        if (cached != null) {
            return cached.get(entity.get***REMOVED***Id());
        }
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", entity.getTenantCode())
                .eq("***REMOVED***_id", entity.get***REMOVED***Id())
                .eq("principal_id", caller.getActorId())
                .eq("principal_type", PrincipalType.USER.name());
        KnowledgeBaseAclEntity acl = aclMapper.selectOne(query);
        if (acl == null) {
            return null;
        }
        if (acl.getExpiresAt() != null && !acl.getExpiresAt().isAfter(Instant.now())) {
            return null;
        }
        return acl.getRole();
    }

    private List<String> readable***REMOVED***Ids(List<String> ***REMOVED***Ids, ***REMOVED***Caller caller) {
        if (***REMOVED***Ids == null || ***REMOVED***Ids.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, String> roles = rolesOf(caller);
        QueryWrapper<KnowledgeBaseEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode()).in("***REMOVED***_id", ***REMOVED***Ids);
        String actorId = caller.getActorId();
        query.and(w -> {
            w.eq("owner_id", actorId);
            if (!roles.isEmpty()) {
                w.or().in("***REMOVED***_id", roles.keySet());
            }
        });
        List<String> result = new ArrayList<>();
        for (KnowledgeBaseEntity entity : ***REMOVED***Mapper.selectList(query)) {
            result.add(entity.get***REMOVED***Id());
        }
        return result;
    }

    private KnowledgeBaseView toView(KnowledgeBaseEntity entity, String role) {
        KnowledgeBaseView view = new KnowledgeBaseView();
        view.set***REMOVED***Id(entity.get***REMOVED***Id());
        view.setTenantCode(entity.getTenantCode());
        view.setName(entity.getName());
        view.setCode(entity.getCode());
        view.setType(KnowledgeBaseType.valueOf(entity.getType()));
        view.setDescription(entity.getDescription());
        view.setOwnerId(entity.getOwnerId());
        view.setStatus(KnowledgeBaseStatus.valueOf(entity.getStatus()));
        view.setEmbeddingModel(entity.getEmbeddingModel());
        view.setPrimaryGraphSpaceKey(entity.getPrimaryGraphSpaceKey());
        view.setArchivedAt(entity.getArchivedAt());
        view.setCreatedAt(entity.getCreateTime());
        view.setUpdatedAt(entity.getUpdateTime());
        boolean admin = KnowledgeBaseRole.***REMOVED***ADMIN.name().equals(role);
        view.setRole(role);
        view.setCanManage(admin);
        view.setCanManageDoc(admin || KnowledgeBaseRole.EDITOR.name().equals(role)
                || KnowledgeBaseRole.CONTRIBUTOR.name().equals(role));
        view.setCanReview(admin || KnowledgeBaseRole.EDITOR.name().equals(role)
                || KnowledgeBaseRole.REVIEWER.name().equals(role));
        view.setActions(KnowledgeBaseRoleActions.actionCodes(role));
        return view;
    }

    private KnowledgeBaseProfileEntity buildInitialProfile(KnowledgeBaseEntity ***REMOVED***, ***REMOVED***Caller caller,
                                                           Instant now) {
        KnowledgeBaseProfileEntity profile = new KnowledgeBaseProfileEntity();
        profile.setId(UUID.randomUUID().toString());
        profile.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
        profile.setTenantCode(***REMOVED***.getTenantCode());
        profile.setType(***REMOVED***.getType());
        profile.setPresetVersion(DEFAULT_PRESET_VERSION);
        profile.setParserPolicy(EMPTY_POLICY);
        profile.setChunkingPolicy(EMPTY_POLICY);
        profile.setExtractionPolicy(EMPTY_POLICY);
        profile.setWikiPolicy(EMPTY_POLICY);
        profile.setGraphPolicy(EMPTY_POLICY);
        profile.setReviewPolicy(EMPTY_POLICY);
        profile.setFreshnessPolicy(EMPTY_POLICY);
        profile.setRetrievalPolicy(EMPTY_POLICY);
        profile.setSourcePolicy(EMPTY_SOURCE_POLICY);
        profile.setConfigVersion(INITIAL_CONFIG_VERSION);
        profile.setCreateBy(caller.getActorId());
        profile.setUpdateBy(caller.getActorId());
        profile.setCreateTime(now);
        profile.setUpdateTime(now);
        return profile;
    }

    private KnowledgeBaseAclEntity buildOwnerAcl(KnowledgeBaseEntity ***REMOVED***, ***REMOVED***Caller caller,
                                                 Instant now) {
        KnowledgeBaseAclEntity entity = new KnowledgeBaseAclEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
        entity.setTenantCode(***REMOVED***.getTenantCode());
        entity.setPrincipalId(caller.getActorId());
        entity.setPrincipalType(PrincipalType.USER.name());
        entity.setRole(KnowledgeBaseRole.***REMOVED***ADMIN.name());
        entity.setGrantedBy(caller.getActorId());
        entity.setGrantedAt(now);
        entity.setCreateBy(caller.getActorId());
        entity.setUpdateBy(caller.getActorId());
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        return entity;
    }

    private String requireName(String value) {
        if (!hasText(value)) {
            throw new ***REMOVED***Exception("***REMOVED***NAME_INVALID", "知识库名称不能为空");
        }
        String name = value.trim();
        if (name.length() > MAX_NAME_LENGTH) {
            throw new ***REMOVED***Exception("***REMOVED***NAME_INVALID", "知识库名称不超过 100 个字符");
        }
        return name;
    }

    private String requireCode(String value) {
        if (!hasText(value)) {
            throw new ***REMOVED***Exception("***REMOVED***CODE_INVALID", "知识库编码不能为空");
        }
        String code = value.trim();
        if (!CODE_PATTERN.matcher(code).matches()) {
            throw new ***REMOVED***Exception("***REMOVED***CODE_INVALID",
                    "知识库编码需以字母开头，3-64 位字母/数字/下划线/短横线");
        }
        return code;
    }

    private String requireDescription(String value) {
        if (value == null) {
            return null;
        }
        String description = value.trim();
        if (description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new ***REMOVED***Exception("***REMOVED***PARAM_INVALID", "知识库描述不超过 500 个字符");
        }
        return description.isEmpty() ? null : description;
    }

    private String normalizeEmbeddingModel(String value) {
        if (!hasText(value)) {
            return DEFAULT_EMBEDDING_MODEL;
        }
        String model = value.trim();
        if (model.length() > MAX_EMBEDDING_MODEL_LENGTH) {
            throw new ***REMOVED***Exception("***REMOVED***PARAM_INVALID", "嵌入模型标识不超过 64 个字符");
        }
        return model;
    }

    private KnowledgeBaseType requireType(KnowledgeBaseType value) {
        return value == null ? KnowledgeBaseType.FILE : value;
    }

    private KnowledgeBaseType parseType(String value) {
        try {
            return KnowledgeBaseType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ***REMOVED***Exception("***REMOVED***TYPE_INVALID", "未知知识库类型：" + value);
        }
    }

    private KnowledgeBaseStatus parseStatus(String value) {
        try {
            return KnowledgeBaseStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_UNKNOWN", "未知知识库状态：" + value);
        }
    }

    private void requireTenant(***REMOVED***Caller caller) {
        if (caller == null || !hasText(caller.getTenantCode())) {
            throw new ***REMOVED***Exception("***REMOVED***TENANT_REQUIRED", "缺少租户上下文");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
