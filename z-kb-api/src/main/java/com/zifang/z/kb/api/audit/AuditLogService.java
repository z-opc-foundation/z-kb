package com.zifang.z.***REMOVED***.api.audit;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.PageResult;

/**
 * 审计日志查询：列表只带摘要列，详情按主键读取。
 */
public interface AuditLogService {

    PageResult<AuditLogView> page(AuditLogQuery query, ***REMOVED***Caller caller);

    AuditLogView get(String id, ***REMOVED***Caller caller);
}
