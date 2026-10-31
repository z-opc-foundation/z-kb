package com.zifang.z.***REMOVED***.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.audit.AuditLogQuery;
import com.zifang.z.***REMOVED***.api.audit.AuditLogService;
import com.zifang.z.***REMOVED***.api.audit.AuditLogView;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.storage.resource.entity.***REMOVED***AuditLogEntity;
import com.zifang.z.***REMOVED***.storage.resource.mapper.***REMOVED***AuditLogMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 审计日志查询：全部条件叠加租户，列表只带摘要列，详情按主键读取。
 *
 * <p>z-***REMOVED*** 的审计只记录成功写操作，因此 success 恒为 1；参考实现里由切面捕获的
 * 方法名、请求路径、出入参等列在本实现中为空。</p>
 */
public class DefaultAuditLogService implements AuditLogService {

    private static final long DEFAULT_SIZE = 20L;

    private static final long MAX_SIZE = 200L;

    private static final String TYPE_***REMOVED*** = "***REMOVED***";

    private static final String TYPE_SYS = "SYS";

    private final ***REMOVED***AuditLogMapper auditLogMapper;

    public DefaultAuditLogService(***REMOVED***AuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
    }

    @Override
    public PageResult<AuditLogView> page(AuditLogQuery query, ***REMOVED***Caller caller) {
        AuditLogQuery q = query == null ? new AuditLogQuery() : query;
        long current = Math.max(1L, q.getCurrent());
        long size = q.getSize() <= 0 ? DEFAULT_SIZE : Math.min(q.getSize(), MAX_SIZE);

        QueryWrapper<***REMOVED***AuditLogEntity> wrapper = filters(q, caller.getTenantCode());
        Long total = auditLogMapper.selectCount(wrapper);
        long count = total == null ? 0L : total;

        wrapper.orderByDesc("created_at").orderByDesc("id")
                .last("LIMIT " + size + " OFFSET " + (current - 1) * size);
        List<AuditLogView> records = new ArrayList<>();
        for (***REMOVED***AuditLogEntity entity : auditLogMapper.selectList(wrapper)) {
            records.add(toView(entity));
        }
        return new PageResult<>(records, count, current, size);
    }

    @Override
    public AuditLogView get(String id, ***REMOVED***Caller caller) {
        if (id == null || id.trim().isEmpty()) {
            return null;
        }
        ***REMOVED***AuditLogEntity entity = auditLogMapper.selectOne(new QueryWrapper<***REMOVED***AuditLogEntity>()
                .eq("tenant_code", caller.getTenantCode())
                .eq("id", id.trim()));
        return entity == null ? null : toView(entity);
    }

    private QueryWrapper<***REMOVED***AuditLogEntity> filters(AuditLogQuery query, String tenantCode) {
        QueryWrapper<***REMOVED***AuditLogEntity> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_code", tenantCode);

        String keyword = trimToNull(query.getKeyword());
        if (keyword != null) {
            wrapper.and(condition -> condition.like("action", keyword)
                    .or().like("detail", keyword)
                    .or().like("target_type", keyword)
                    .or().like("target_id", keyword));
        }
        String actorId = trimToNull(query.getActorId());
        if (actorId != null) {
            wrapper.eq("actor_id", actorId);
        }
        String type = trimToNull(query.getType());
        if (type != null) {
            if (TYPE_***REMOVED***.equalsIgnoreCase(type)) {
                wrapper.isNotNull("***REMOVED***_id");
            } else if (TYPE_SYS.equalsIgnoreCase(type)) {
                wrapper.isNull("***REMOVED***_id");
            }
        }
        String bizRef = trimToNull(query.getBizRef());
        if (bizRef != null) {
            wrapper.eq("***REMOVED***_id", bizRef);
        }
        if (query.getSuccess() != null) {
            wrapper.eq("success", query.getSuccess() != 0);
        }
        Instant start = toInstant(query.getStartTime());
        if (start != null) {
            wrapper.ge("created_at", start);
        }
        Instant end = toInstant(query.getEndTime());
        if (end != null) {
            wrapper.le("created_at", end);
        }
        return wrapper;
    }

    private AuditLogView toView(***REMOVED***AuditLogEntity entity) {
        AuditLogView view = new AuditLogView();
        view.setId(entity.getId());
        view.setTenantCode(entity.getTenantCode());
        view.setType(entity.get***REMOVED***Id() == null ? TYPE_SYS : TYPE_***REMOVED***);
        view.setBizRef(entity.get***REMOVED***Id());
        view.setActorId(entity.getActorId());
        view.setAction(entity.getAction());
        view.setActionDesc(entity.getDetail());
        view.setSuccess(Boolean.TRUE.equals(entity.getSuccess()) ? 1 : 0);
        view.setCreateTime(entity.getCreatedAt());
        return view;
    }

    private static Instant toInstant(Long millis) {
        return millis == null || millis <= 0 ? null : Instant.ofEpochMilli(millis);
    }

    private static String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
