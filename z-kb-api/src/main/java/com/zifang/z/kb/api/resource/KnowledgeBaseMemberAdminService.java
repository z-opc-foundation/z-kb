package com.zifang.z.kb.api.resource;

/**
 * 库成员与有效权限管理。
 *
 * <p>读写都先过 {@link KnowledgeBaseResourceService} 的访问边界；创建者不可降级/移除，
 * 且库内必须始终保留至少一名管理员。</p>
 */
public interface KnowledgeBaseMemberAdminService {

    /** 成员列表，仅库管可读；创建者行随库事实一起返回。 */
    java.util.List<KnowledgeBaseMember> listMembers(String kbId, KbCaller caller);

    /** 候选主体，排除已加入成员与创建者；目录不可用时返回空列表。 */
    java.util.List<KnowledgeBaseMemberCandidate> searchCandidates(String kbId, String keyword,
                                                                 KbCaller caller);

    /** 授权或显式改角色。 */
    KnowledgeBaseMember grant(String kbId, String principalId, String role, KbCaller caller);

    /** 撤销授权，立即失效。 */
    boolean revoke(String kbId, String principalId, KbCaller caller);

    /** 当前调用者在本库的有效权限，读权限即可查询。 */
    KnowledgeBaseEffective effective(String kbId, KbCaller caller);
}
