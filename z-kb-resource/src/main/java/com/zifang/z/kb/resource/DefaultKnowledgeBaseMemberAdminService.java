package com.zifang.z.***REMOVED***.resource;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***PrincipalDirectory;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseEffective;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMember;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberCandidate;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseRole;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PrincipalType;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseAclEntity;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseAclMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 成员与权限默认实现：创建者不可降级/移除，库内必须始终保留至少一名管理员。
 */
public class DefaultKnowledgeBaseMemberAdminService implements KnowledgeBaseMemberAdminService {

    private static final int DEFAULT_CANDIDATE_LIMIT = 20;

    private final KnowledgeBaseResourceService resourceService;
    private final KnowledgeBaseAclMapper aclMapper;
    private final ***REMOVED***PrincipalDirectory principalDirectory;
    private final ***REMOVED***AuditService auditService;

    public DefaultKnowledgeBaseMemberAdminService(KnowledgeBaseResourceService resourceService,
                                                  KnowledgeBaseAclMapper aclMapper,
                                                  ***REMOVED***PrincipalDirectory principalDirectory,
                                                  ***REMOVED***AuditService auditService) {
        this.resourceService = resourceService;
        this.aclMapper = aclMapper;
        this.principalDirectory = principalDirectory;
        this.auditService = auditService;
    }

    @Override
    public List<KnowledgeBaseMember> listMembers(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        List<KnowledgeBaseAclEntity> rows = effectiveRows(***REMOVED***);
        boolean ownerInRows = rows.stream()
                .anyMatch(row -> ***REMOVED***.getOwnerId() != null
                        && ***REMOVED***.getOwnerId().equals(row.getPrincipalId()));
        if (!ownerInRows) {
            KnowledgeBaseAclEntity owner = new KnowledgeBaseAclEntity();
            owner.setPrincipalId(***REMOVED***.getOwnerId());
            owner.setPrincipalType(PrincipalType.USER.name());
            owner.setRole(KnowledgeBaseRole.***REMOVED***ADMIN.name());
            owner.setGrantedBy(***REMOVED***.getOwnerId());
            owner.setGrantedAt(***REMOVED***.getCreatedAt());
            rows = new ArrayList<>(rows);
            rows.add(owner);
        }
        Map<String, KnowledgeBaseMemberCandidate> principals = resolvePrincipals(***REMOVED***, rows);
        List<KnowledgeBaseMember> result = new ArrayList<>();
        for (KnowledgeBaseAclEntity row : rows) {
            result.add(toMember(row, ***REMOVED***, principals.get(row.getPrincipalId())));
        }
        result.sort((left, right) -> {
            if (left.isOwner() != right.isOwner()) {
                return left.isOwner() ? -1 : 1;
            }
            if (left.getGrantedAt() == null || right.getGrantedAt() == null) {
                return 0;
            }
            return left.getGrantedAt().compareTo(right.getGrantedAt());
        });
        return result;
    }

    @Override
    public List<KnowledgeBaseMemberCandidate> searchCandidates(String ***REMOVED***Id, String keyword,
                                                               ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!principalDirectory.isAvailable()) {
            return Collections.emptyList();
        }
        Set<String> joined = new HashSet<>();
        joined.add(***REMOVED***.getOwnerId());
        for (KnowledgeBaseAclEntity row : effectiveRows(***REMOVED***)) {
            joined.add(row.getPrincipalId());
        }
        List<KnowledgeBaseMemberCandidate> result = new ArrayList<>();
        for (KnowledgeBaseMemberCandidate candidate : principalDirectory.search(
                ***REMOVED***.getTenantCode(), keyword, DEFAULT_CANDIDATE_LIMIT)) {
            if (candidate == null || candidate.getPrincipalId() == null
                    || joined.contains(candidate.getPrincipalId())) {
                continue;
            }
            result.add(candidate);
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseMember grant(String ***REMOVED***Id, String principalId, String role,
                                     ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!hasText(principalId)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_PRINCIPAL_INVALID", "成员主体标识不能为空");
        }
        String normalizedRole = parseRole(role);
        KnowledgeBaseMemberCandidate principal = principalDirectory.isAvailable()
                ? principalDirectory.findById(***REMOVED***.getTenantCode(), principalId) : null;
        if (principalDirectory.isAvailable() && principal == null) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_PRINCIPAL_INVALID", "成员不存在：" + principalId);
        }
        if (principalId.equals(***REMOVED***.getOwnerId())
                && !KnowledgeBaseRole.***REMOVED***ADMIN.name().equals(normalizedRole)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_OWNER_PROTECTED", "知识库创建者不能降级");
        }
        List<KnowledgeBaseAclEntity> rows = effectiveRows(***REMOVED***);
        if (!KnowledgeBaseRole.***REMOVED***ADMIN.name().equals(normalizedRole)
                && isAdmin(rows, principalId) && !hasOtherAdmin(rows, ***REMOVED***, principalId)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_LAST_ADMIN", "必须保留至少一名知识库管理员");
        }

        Instant now = Instant.now();
        KnowledgeBaseAclEntity existing = selectGrant(***REMOVED***.getTenantCode(), ***REMOVED***.get***REMOVED***Id(), principalId);
        KnowledgeBaseAclEntity saved;
        if (existing == null) {
            saved = new KnowledgeBaseAclEntity();
            saved.setId(UUID.randomUUID().toString());
            saved.setTenantCode(***REMOVED***.getTenantCode());
            saved.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
            saved.setPrincipalId(principalId);
            saved.setPrincipalType(PrincipalType.USER.name());
            saved.setRole(normalizedRole);
            saved.setGrantedBy(caller.getActorId());
            saved.setGrantedAt(now);
            saved.setCreateBy(caller.getActorId());
            saved.setUpdateBy(caller.getActorId());
            saved.setCreateTime(now);
            saved.setUpdateTime(now);
            aclMapper.insert(saved);
        } else {
            existing.setRole(normalizedRole);
            existing.setGrantedBy(caller.getActorId());
            existing.setGrantedAt(now);
            existing.setExpiresAt(null);
            existing.setUpdateBy(caller.getActorId());
            existing.setUpdateTime(now);
            aclMapper.updateById(existing);
            saved = existing;
        }
        auditService.record(caller, ***REMOVED***.get***REMOVED***Id(), "***REMOVED***.member.grant", "ACL",
                saved.getId(), "授予 " + principalId + " 角色 " + normalizedRole);
        return toMember(saved, ***REMOVED***, principal);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean revoke(String ***REMOVED***Id, String principalId, ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!hasText(principalId)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_NOT_FOUND", "成员主体标识不能为空");
        }
        if (principalId.equals(***REMOVED***.getOwnerId())) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_OWNER_PROTECTED", "知识库创建者不能移除");
        }
        KnowledgeBaseAclEntity existing = selectGrant(***REMOVED***.getTenantCode(), ***REMOVED***.get***REMOVED***Id(), principalId);
        if (existing == null || !isEffective(existing)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_NOT_FOUND", "该成员不在知识库中：" + principalId);
        }
        List<KnowledgeBaseAclEntity> rows = effectiveRows(***REMOVED***);
        if (isAdmin(rows, principalId) && !hasOtherAdmin(rows, ***REMOVED***, principalId)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_LAST_ADMIN", "必须保留至少一名知识库管理员");
        }
        aclMapper.deleteById(existing.getId());
        auditService.record(caller, ***REMOVED***.get***REMOVED***Id(), "***REMOVED***.member.revoke", "ACL",
                existing.getId(), "移除成员 " + principalId);
        return true;
    }

    @Override
    public KnowledgeBaseEffective effective(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireReadable(***REMOVED***Id, caller);
        String role = ***REMOVED***.getRole() == null ? KnowledgeBaseRole.READER.name() : ***REMOVED***.getRole();
        KnowledgeBaseEffective effective = new KnowledgeBaseEffective();
        effective.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
        effective.setActorId(caller.getActorId());
        effective.setRole(role);
        effective.setOwner(caller.isSameActor(***REMOVED***.getOwnerId()));
        effective.setCanEnter(true);
        effective.setCanManage***REMOVED***(***REMOVED***.isCanManage());
        effective.setCanManageDoc(***REMOVED***.isCanManage() || ***REMOVED***.isCanManageDoc());
        effective.setCanReview(***REMOVED***.isCanManage() || ***REMOVED***.isCanReview());
        effective.setActions(***REMOVED***.getActions() == null
                ? new ArrayList<>() : new ArrayList<>(***REMOVED***.getActions()));
        return effective;
    }

    // ==================== 内部工具 ====================

    private List<KnowledgeBaseAclEntity> effectiveRows(KnowledgeBaseView ***REMOVED***) {
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", ***REMOVED***.getTenantCode()).eq("***REMOVED***_id", ***REMOVED***.get***REMOVED***Id());
        List<KnowledgeBaseAclEntity> result = new ArrayList<>();
        for (KnowledgeBaseAclEntity row : aclMapper.selectList(query)) {
            if (isEffective(row)) {
                result.add(row);
            }
        }
        return result;
    }

    private KnowledgeBaseAclEntity selectGrant(String tenantCode, String ***REMOVED***Id, String principalId) {
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("principal_type", PrincipalType.USER.name())
                .eq("principal_id", principalId);
        return aclMapper.selectOne(query);
    }

    private Map<String, KnowledgeBaseMemberCandidate> resolvePrincipals(KnowledgeBaseView ***REMOVED***,
                                                                        List<KnowledgeBaseAclEntity> rows) {
        Map<String, KnowledgeBaseMemberCandidate> result = new HashMap<>();
        if (!principalDirectory.isAvailable()) {
            return result;
        }
        Set<String> ids = new LinkedHashSet<>();
        for (KnowledgeBaseAclEntity row : rows) {
            if (row.getPrincipalId() != null) {
                ids.add(row.getPrincipalId());
            }
        }
        for (String id : ids) {
            KnowledgeBaseMemberCandidate candidate = principalDirectory.findById(
                    ***REMOVED***.getTenantCode(), id);
            if (candidate != null) {
                result.put(id, candidate);
            }
        }
        return result;
    }

    private KnowledgeBaseMember toMember(KnowledgeBaseAclEntity row, KnowledgeBaseView ***REMOVED***,
                                         KnowledgeBaseMemberCandidate principal) {
        KnowledgeBaseMember member = new KnowledgeBaseMember();
        member.setPrincipalId(row.getPrincipalId());
        member.setPrincipalType(PrincipalType.valueOf(row.getPrincipalType()));
        member.setRole(KnowledgeBaseRole.valueOf(row.getRole()));
        member.setOwner(row.getPrincipalId() != null && row.getPrincipalId().equals(***REMOVED***.getOwnerId()));
        member.setGrantedBy(row.getGrantedBy());
        member.setGrantedAt(row.getGrantedAt());
        member.setExpiresAt(row.getExpiresAt());
        if (principal != null) {
            member.setName(principal.getName());
            member.setEmployeeId(principal.getEmployeeId());
            member.setDept(principal.getDept());
        }
        return member;
    }

    private boolean isAdmin(List<KnowledgeBaseAclEntity> rows, String principalId) {
        for (KnowledgeBaseAclEntity row : rows) {
            if (principalId.equals(row.getPrincipalId())
                    && KnowledgeBaseRole.***REMOVED***ADMIN.name().equals(row.getRole())) {
                return true;
            }
        }
        return false;
    }

    private boolean hasOtherAdmin(List<KnowledgeBaseAclEntity> rows, KnowledgeBaseView ***REMOVED***,
                                  String excludePrincipalId) {
        if (***REMOVED***.getOwnerId() != null && !***REMOVED***.getOwnerId().equals(excludePrincipalId)) {
            return true;
        }
        for (KnowledgeBaseAclEntity row : rows) {
            if (!excludePrincipalId.equals(row.getPrincipalId())
                    && KnowledgeBaseRole.***REMOVED***ADMIN.name().equals(row.getRole())) {
                return true;
            }
        }
        return false;
    }

    private boolean isEffective(KnowledgeBaseAclEntity row) {
        return row.getExpiresAt() == null || row.getExpiresAt().isAfter(Instant.now());
    }

    private String parseRole(String value) {
        if (!hasText(value)) {
            throw new ***REMOVED***Exception("***REMOVED***MEMBER_ROLE_INVALID", "成员角色不能为空");
        }
        String role = value.trim().toUpperCase(Locale.ROOT);
        for (KnowledgeBaseRole candidate : KnowledgeBaseRole.values()) {
            if (candidate.name().equals(role)) {
                return role;
            }
        }
        throw new ***REMOVED***Exception("***REMOVED***MEMBER_ROLE_INVALID", "未知成员角色：" + value);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
