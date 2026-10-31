package com.zifang.z.kb.api.audit;

import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.PageResult;

/**
 * 审计日志查询：列表只带摘要列，详情按主键读取。
 */
public interface AuditLogService {

    PageResult<AuditLogView> page(AuditLogQuery query, KbCaller caller);

    AuditLogView get(String id, KbCaller caller);
}
