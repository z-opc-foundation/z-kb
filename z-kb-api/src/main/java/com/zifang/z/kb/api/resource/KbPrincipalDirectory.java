package com.zifang.z.kb.api.resource;

/**
 * 主体目录 SPI：知识库成员展示与候选搜索依赖的身份资料来源。
 *
 * <p>生产环境由 z-ctc 适配实现；未提供实现时 {@link #isAvailable()} 返回 false，
 * 成员功能仍可用（只是不展示姓名/工号/部门，也不提供候选搜索）。</p>
 */
public interface KbPrincipalDirectory {

    /** 目录是否可用；false 时服务不强制主体存在性校验。 */
    default boolean isAvailable() {
        return true;
    }

    /** 按姓名/工号/部门关键词搜索本租户候选主体，最多 limit 条。 */
    java.util.List<KnowledgeBaseMemberCandidate> search(String tenantCode, String keyword, int limit);

    /** 按主体标识查询展示信息，不存在返回 null。 */
    KnowledgeBaseMemberCandidate findById(String tenantCode, String principalId);
}
