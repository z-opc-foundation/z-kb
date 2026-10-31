package com.zifang.z.***REMOVED***.api.resource;

/**
 * 知识库配置版本：草稿、差异、影响分析、校验与发布。
 */
public interface KnowledgeBaseConfigService {

    /** 配置总览：当前版本、草稿、历史版本及草稿差异、重建影响与校验结果。 */
    KnowledgeBaseConfigView query(String ***REMOVED***Id, ***REMOVED***Caller caller);

    /** 保存配置草稿（无则新建、有则覆盖），需 ***REMOVED***MANAGE 权限。 */
    KnowledgeBaseProfileVersion saveDraft(String ***REMOVED***Id, KnowledgeBaseProfileVersion draft,
                                          ***REMOVED***Caller caller);

    /** 丢弃当前草稿，需 ***REMOVED***MANAGE 权限；无草稿时幂等返回。 */
    boolean discardDraft(String ***REMOVED***Id, ***REMOVED***Caller caller);

    /** 只读校验草稿，不修改任何版本数据。 */
    ConfigValidation validateDraft(String ***REMOVED***Id, ***REMOVED***Caller caller);

    /**
     * 发布草稿为当前版本并同步配置档案主表。
     *
     * @param confirm 必须为 true，否则抛 ***REMOVED***CONFIG_CONFIRM_REQUIRED
     * @param remark  发布说明，可空
     */
    KnowledgeBaseProfileVersion publish(String ***REMOVED***Id, String remark, boolean confirm, ***REMOVED***Caller caller);
}
