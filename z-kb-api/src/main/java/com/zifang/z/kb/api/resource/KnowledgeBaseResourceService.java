package com.zifang.z.kb.api.resource;

/**
 * 知识库资源服务：知识库生命周期 + 访问边界 + 活跃度。
 *
 * <p>所有方法都显式接收 {@link KbCaller}，服务内部不读线程上下文。</p>
 */
public interface KnowledgeBaseResourceService {

    /** 分页查询当前调用者可见（所有者或已授权）的知识库。 */
    PageResult<KnowledgeBaseView> page(KnowledgeBaseQuery query, KbCaller caller);

    /** 按 kbId 查询详情，要求可读。 */
    KnowledgeBaseView detail(String kbId, KbCaller caller);

    /** 创建知识库：初始化配置档案与创建者管理员 ACL。 */
    KnowledgeBaseView create(KnowledgeBase input, KbCaller caller);

    /** 更新名称与描述，要求 KB_MANAGE。 */
    KnowledgeBaseView update(String kbId, String name, String description, KbCaller caller);

    /** 归档 ACTIVE → ARCHIVED，要求 KB_MANAGE。 */
    boolean archive(String kbId, KbCaller caller);

    /** 恢复 ARCHIVED → ACTIVE，要求 KB_MANAGE。 */
    boolean restore(String kbId, KbCaller caller);

    /** 删除已归档知识库及其配置、版本与 ACL，要求 KB_MANAGE。 */
    boolean remove(String kbId, KbCaller caller);

    /**
     * 批量查询知识库近 days 天每日成功操作次数（数据源为审计日志）。
     * days ≤ 0 时默认 168，上限 365。
     */
    java.util.Map<String, java.util.List<KnowledgeBaseActivityPoint>> heatmap(
            java.util.List<String> kbIds, int days, KbCaller caller);

    /** 读取并校验可读性（所有者或存在有效授权），否则抛 KB_NOT_FOUND / KB_FORBIDDEN。 */
    KnowledgeBaseView requireReadable(String kbId, KbCaller caller);

    /** 在可读基础上校验角色动作权限，否则抛 KB_ACTION_FORBIDDEN。 */
    KnowledgeBaseView requireActionable(String kbId, KnowledgeBaseAction action, KbCaller caller);
}
