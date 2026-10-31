package com.zifang.z.***REMOVED***.api.source;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 接入源同步。z-***REMOVED*** 没有独立任务内核，同步在请求内执行并返回计数；
 * 拉取与物料登记都复用 {@code MaterialService.syncUpsert}。
 */
public interface IngestService {

    /** 执行一次同步：校验权限与范围，按供应商分派连接器。 */
    KnowledgeBaseSourceSyncView sync(String ***REMOVED***Id, String sourceId, ***REMOVED***Caller caller);
}
