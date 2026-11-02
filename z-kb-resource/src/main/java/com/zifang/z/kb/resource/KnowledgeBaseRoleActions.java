package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseRole;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 角色-动作矩阵的唯一事实来源。接口鉴权与能力位下发都读这一份。
 */
public final class KnowledgeBaseRoleActions {

    private static final Map<KnowledgeBaseRole, Set<KnowledgeBaseAction>> ROLE_ACTIONS =
            new EnumMap<>(KnowledgeBaseRole.class);

    static {
        ROLE_ACTIONS.put(KnowledgeBaseRole.KB_ADMIN, EnumSet.of(
                KnowledgeBaseAction.KB_READ, KnowledgeBaseAction.KB_MANAGE,
                KnowledgeBaseAction.MEMBER_MANAGE, KnowledgeBaseAction.MATERIAL_WRITE,
                KnowledgeBaseAction.MATERIAL_REVIEW, KnowledgeBaseAction.COMPILATION_RUN,
                KnowledgeBaseAction.WIKI_READ, KnowledgeBaseAction.RETRIEVAL_QUERY,
                KnowledgeBaseAction.LINEAGE_READ));
        ROLE_ACTIONS.put(KnowledgeBaseRole.EDITOR, EnumSet.of(
                KnowledgeBaseAction.KB_READ, KnowledgeBaseAction.MATERIAL_WRITE,
                KnowledgeBaseAction.MATERIAL_REVIEW, KnowledgeBaseAction.COMPILATION_RUN,
                KnowledgeBaseAction.WIKI_READ, KnowledgeBaseAction.RETRIEVAL_QUERY,
                KnowledgeBaseAction.LINEAGE_READ));
        ROLE_ACTIONS.put(KnowledgeBaseRole.CONTRIBUTOR, EnumSet.of(
                KnowledgeBaseAction.KB_READ, KnowledgeBaseAction.MATERIAL_WRITE,
                KnowledgeBaseAction.WIKI_READ, KnowledgeBaseAction.RETRIEVAL_QUERY));
        ROLE_ACTIONS.put(KnowledgeBaseRole.REVIEWER, EnumSet.of(
                KnowledgeBaseAction.KB_READ, KnowledgeBaseAction.MATERIAL_REVIEW,
                KnowledgeBaseAction.WIKI_READ, KnowledgeBaseAction.RETRIEVAL_QUERY,
                KnowledgeBaseAction.LINEAGE_READ));
        ROLE_ACTIONS.put(KnowledgeBaseRole.READER, EnumSet.of(
                KnowledgeBaseAction.KB_READ, KnowledgeBaseAction.WIKI_READ,
                KnowledgeBaseAction.RETRIEVAL_QUERY));
    }

    private KnowledgeBaseRoleActions() {
    }

    /** 角色是否拥有指定动作权限；角色为空或非法时返回 false。 */
    public static boolean can(String role, KnowledgeBaseAction action) {
        if (role == null || action == null) {
            return false;
        }
        KnowledgeBaseRole parsed = parse(role);
        return parsed != null && ROLE_ACTIONS.getOrDefault(parsed, Collections.emptySet())
                .contains(action);
    }

    /** 返回角色可执行动作的编码列表（已排序）；非法角色返回空列表。 */
    public static List<String> actionCodes(String role) {
        List<String> codes = new ArrayList<>();
        KnowledgeBaseRole parsed = parse(role);
        if (parsed == null) {
            return codes;
        }
        for (KnowledgeBaseAction action : ROLE_ACTIONS.getOrDefault(parsed,
                Collections.emptySet())) {
            codes.add(action.getCode());
        }
        Collections.sort(codes);
        return codes;
    }

    /** 解析角色名（忽略大小写），非法返回 null。 */
    public static KnowledgeBaseRole parse(String role) {
        if (role == null || role.trim().isEmpty()) {
            return null;
        }
        try {
            return KnowledgeBaseRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
