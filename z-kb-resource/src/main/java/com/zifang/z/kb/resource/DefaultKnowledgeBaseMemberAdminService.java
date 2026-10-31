package com.zifang.z.kb.resource;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KbPrincipalDirectory;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseEffective;
import com.zifang.z.kb.api.resource.KnowledgeBaseMember;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberCandidate;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseRole;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.PrincipalType;
import com.zifang.z.kb.storage.resource.entity.KnowledgeBaseAclEntity;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseAclMapper;
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
    private final KbPrincipalDirectory principalDirectory;
    private final KbAuditService auditService;

    public DefaultKnowledgeBaseMemberAdminService(KnowledgeBaseResourceService resourceService,
                                                  KnowledgeBaseAclMapper aclMapper,
                                                  KbPrincipalDirectory principalDirectory,
                                                  KbAuditService auditService) {
        this.resourceService = resourceService;
        this.aclMapper = aclMapper;
        this.principalDirectory = principalDirectory;
        this.auditService = auditService;
    }

    @Override
    public List<KnowledgeBaseMember> listMembers(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        List<KnowledgeBaseAclEntity> rows = effectiveRows(kb);
        boolean ownerInRows = rows.stream()
                .anyMatch(row -> kb.getOwnerId() != null
                        && kb.getOwnerId().equals(row.getPrincipalId()));
        if (!ownerInRows) {
            KnowledgeBaseAclEntity owner = new KnowledgeBaseAclEntity();
            owner.setPrincipalId(kb.getOwnerId());
            owner.setPrincipalType(PrincipalType.USER.name());
            owner.setRole(KnowledgeBaseRole.KB_ADMIN.name());
            owner.setGrantedBy(kb.getOwnerId());
            owner.setGrantedAt(kb.getCreatedAt());
            rows = new ArrayList<>(rows);
            rows.add(owner);
        }
        Map<String, KnowledgeBaseMemberCandidate> principals = resolvePrincipals(kb, rows);
        List<KnowledgeBaseMember> result = new ArrayList<>();
        for (KnowledgeBaseAclEntity row : rows) {
            result.add(toMember(row, kb, principals.get(row.getPrincipalId())));
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
    public List<KnowledgeBaseMemberCandidate> searchCandidates(String kbId, String keyword,
                                                               KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!principalDirectory.isAvailable()) {
            return Collections.emptyList();
        }
        Set<String> joined = new HashSet<>();
        joined.add(kb.getOwnerId());
        for (KnowledgeBaseAclEntity row : effectiveRows(kb)) {
            joined.add(row.getPrincipalId());
        }
        List<KnowledgeBaseMemberCandidate> result = new ArrayList<>();
        for (KnowledgeBaseMemberCandidate candidate : principalDirectory.search(
                kb.getTenantCode(), keyword, DEFAULT_CANDIDATE_LIMIT)) {
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
    public KnowledgeBaseMember grant(String kbId, String principalId, String role,
                                     KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!hasText(principalId)) {
            throw new KBException("KB_MEMBER_PRINCIPAL_INVALID", "成员主体标识不能为空");
        }
        String normalizedRole = parseRole(role);
        KnowledgeBaseMemberCandidate principal = principalDirectory.isAvailable()
                ? principalDirectory.findById(kb.getTenantCode(), principalId) : null;
        if (principalDirectory.isAvailable() && principal == null) {
            throw new KBException("KB_MEMBER_PRINCIPAL_INVALID", "成员不存在：" + principalId);
        }
        if (principalId.equals(kb.getOwnerId())
                && !KnowledgeBaseRole.KB_ADMIN.name().equals(normalizedRole)) {
            throw new KBException("KB_MEMBER_OWNER_PROTECTED", "知识库创建者不能降级");
        }
        List<KnowledgeBaseAclEntity> rows = effectiveRows(kb);
        if (!KnowledgeBaseRole.KB_ADMIN.name().equals(normalizedRole)
                && isAdmin(rows, principalId) && !hasOtherAdmin(rows, kb, principalId)) {
            throw new KBException("KB_MEMBER_LAST_ADMIN", "必须保留至少一名知识库管理员");
        }

        Instant now = Instant.now();
        KnowledgeBaseAclEntity existing = selectGrant(kb.getTenantCode(), kb.getKbId(), principalId);
        KnowledgeBaseAclEntity saved;
        if (existing == null) {
            saved = new KnowledgeBaseAclEntity();
            saved.setId(UUID.randomUUID().toString());
            saved.setTenantCode(kb.getTenantCode());
            saved.setKbId(kb.getKbId());
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
        auditService.record(caller, kb.getKbId(), "kb.member.grant", "ACL",
                saved.getId(), "授予 " + principalId + " 角色 " + normalizedRole);
        return toMember(saved, kb, principal);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean revoke(String kbId, String principalId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.MEMBER_MANAGE, caller);
        if (!hasText(principalId)) {
            throw new KBException("KB_MEMBER_NOT_FOUND", "成员主体标识不能为空");
        }
        if (principalId.equals(kb.getOwnerId())) {
            throw new KBException("KB_MEMBER_OWNER_PROTECTED", "知识库创建者不能移除");
        }
        KnowledgeBaseAclEntity existing = selectGrant(kb.getTenantCode(), kb.getKbId(), principalId);
        if (existing == null || !isEffective(existing)) {
            throw new KBException("KB_MEMBER_NOT_FOUND", "该成员不在知识库中：" + principalId);
        }
        List<KnowledgeBaseAclEntity> rows = effectiveRows(kb);
        if (isAdmin(rows, principalId) && !hasOtherAdmin(rows, kb, principalId)) {
            throw new KBException("KB_MEMBER_LAST_ADMIN", "必须保留至少一名知识库管理员");
        }
        aclMapper.deleteById(existing.getId());
        auditService.record(caller, kb.getKbId(), "kb.member.revoke", "ACL",
                existing.getId(), "移除成员 " + principalId);
        return true;
    }

    @Override
    public KnowledgeBaseEffective effective(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireReadable(kbId, caller);
        String role = kb.getRole() == null ? KnowledgeBaseRole.READER.name() : kb.getRole();
        KnowledgeBaseEffective effective = new KnowledgeBaseEffective();
        effective.setKbId(kb.getKbId());
        effective.setActorId(caller.getActorId());
        effective.setRole(role);
        effective.setOwner(caller.isSameActor(kb.getOwnerId()));
        effective.setCanEnter(true);
        effective.setCanManageKb(kb.isCanManage());
        effective.setCanManageDoc(kb.isCanManage() || kb.isCanManageDoc());
        effective.setCanReview(kb.isCanManage() || kb.isCanReview());
        effective.setActions(kb.getActions() == null
                ? new ArrayList<>() : new ArrayList<>(kb.getActions()));
        return effective;
    }

    // ==================== 内部工具 ====================

    private List<KnowledgeBaseAclEntity> effectiveRows(KnowledgeBaseView kb) {
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", kb.getTenantCode()).eq("kb_id", kb.getKbId());
        List<KnowledgeBaseAclEntity> result = new ArrayList<>();
        for (KnowledgeBaseAclEntity row : aclMapper.selectList(query)) {
            if (isEffective(row)) {
                result.add(row);
            }
        }
        return result;
    }

    private KnowledgeBaseAclEntity selectGrant(String tenantCode, String kbId, String principalId) {
        QueryWrapper<KnowledgeBaseAclEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("principal_type", PrincipalType.USER.name())
                .eq("principal_id", principalId);
        return aclMapper.selectOne(query);
    }

    private Map<String, KnowledgeBaseMemberCandidate> resolvePrincipals(KnowledgeBaseView kb,
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
                    kb.getTenantCode(), id);
            if (candidate != null) {
                result.put(id, candidate);
            }
        }
        return result;
    }

    private KnowledgeBaseMember toMember(KnowledgeBaseAclEntity row, KnowledgeBaseView kb,
                                         KnowledgeBaseMemberCandidate principal) {
        KnowledgeBaseMember member = new KnowledgeBaseMember();
        member.setPrincipalId(row.getPrincipalId());
        member.setPrincipalType(PrincipalType.valueOf(row.getPrincipalType()));
        member.setRole(KnowledgeBaseRole.valueOf(row.getRole()));
        member.setOwner(row.getPrincipalId() != null && row.getPrincipalId().equals(kb.getOwnerId()));
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
                    && KnowledgeBaseRole.KB_ADMIN.name().equals(row.getRole())) {
                return true;
            }
        }
        return false;
    }

    private boolean hasOtherAdmin(List<KnowledgeBaseAclEntity> rows, KnowledgeBaseView kb,
                                  String excludePrincipalId) {
        if (kb.getOwnerId() != null && !kb.getOwnerId().equals(excludePrincipalId)) {
            return true;
        }
        for (KnowledgeBaseAclEntity row : rows) {
            if (!excludePrincipalId.equals(row.getPrincipalId())
                    && KnowledgeBaseRole.KB_ADMIN.name().equals(row.getRole())) {
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
            throw new KBException("KB_MEMBER_ROLE_INVALID", "成员角色不能为空");
        }
        String role = value.trim().toUpperCase(Locale.ROOT);
        for (KnowledgeBaseRole candidate : KnowledgeBaseRole.values()) {
            if (candidate.name().equals(role)) {
                return role;
            }
        }
        throw new KBException("KB_MEMBER_ROLE_INVALID", "未知成员角色：" + value);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
