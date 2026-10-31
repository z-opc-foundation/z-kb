package com.zifang.z.kb.resource.source;

import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.kb.core.source.IngestSyncInfo;

/**
 * 一种接入源的同步执行器。统一入口只做「拉来源、登记物料」，
 * 目录结构、增量口径、凭据方式由各供应商自己解释。
 */
public interface IngestConnector {

    /** 支持的供应商。 */
    KnowledgeBaseSourceProvider provider();

    /** 校验同步范围是否完整（例如语雀的团队空间+知识库、Git 的仓库+分支）。 */
    void checkScope(KnowledgeBaseSourceAccess source);

    /** 冻结本次同步范围，写进同步回执。 */
    String inputSnapshot(KnowledgeBaseSourceAccess source);

    /** 执行一次整库同步，返回计数与失败明细。 */
    IngestSyncInfo sync(String kbId, KnowledgeBaseSourceAccess source, KbCaller caller);
}
