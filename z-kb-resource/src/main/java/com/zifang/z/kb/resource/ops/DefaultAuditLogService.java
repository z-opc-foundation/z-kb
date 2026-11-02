package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.audit.AuditLogQuery;
import com.zifang.z.kb.api.audit.AuditLogService;
import com.zifang.z.kb.api.audit.AuditLogView;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.PageResult;
import com.zifang.z.kb.storage.resource.entity.KbAuditLogEntity;
import com.zifang.z.kb.storage.resource.mapper.KbAuditLogMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 审计日志查询：全部条件叠加租户，列表只带摘要列，详情按主键读取。
 *
 * <p>z-kb 的审计只记录成功写操作，因此 success 恒为 1；参考实现里由切面捕获的
 * 方法名、请求路径、出入参等列在本实现中为空。</p>
 */
public class DefaultAuditLogService implements AuditLogService {

    private static final long DEFAULT_SIZE = 20L;

    private static final long MAX_SIZE = 200L;

    private static final String TYPE_KB = "KB";

    private static final String TYPE_SYS = "SYS";

    private final KbAuditLogMapper auditLogMapper;

    public DefaultAuditLogService(KbAuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
    }

    @Override
    public PageResult<AuditLogView> page(AuditLogQuery query, KbCaller caller) {
        AuditLogQuery q = query == null ? new AuditLogQuery() : query;
        long current = Math.max(1L, q.getCurrent());
        long size = q.getSize() <= 0 ? DEFAULT_SIZE : Math.min(q.getSize(), MAX_SIZE);

        QueryWrapper<KbAuditLogEntity> wrapper = filters(q, caller.getTenantCode());
        Long total = auditLogMapper.selectCount(wrapper);
        long count = total == null ? 0L : total;

        wrapper.orderByDesc("created_at").orderByDesc("id")
                .last("LIMIT " + size + " OFFSET " + (current - 1) * size);
        List<AuditLogView> records = new ArrayList<>();
        for (KbAuditLogEntity entity : auditLogMapper.selectList(wrapper)) {
            records.add(toView(entity));
        }
        return new PageResult<>(records, count, current, size);
    }

    @Override
    public AuditLogView get(String id, KbCaller caller) {
        if (id == null || id.trim().isEmpty()) {
            return null;
        }
        KbAuditLogEntity entity = auditLogMapper.selectOne(new QueryWrapper<KbAuditLogEntity>()
                .eq("tenant_code", caller.getTenantCode())
                .eq("id", id.trim()));
        return entity == null ? null : toView(entity);
    }

    private QueryWrapper<KbAuditLogEntity> filters(AuditLogQuery query, String tenantCode) {
        QueryWrapper<KbAuditLogEntity> wrapper = new QueryWrapper<>();
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
            if (TYPE_KB.equalsIgnoreCase(type)) {
                wrapper.isNotNull("kb_id");
            } else if (TYPE_SYS.equalsIgnoreCase(type)) {
                wrapper.isNull("kb_id");
            }
        }
        String bizRef = trimToNull(query.getBizRef());
        if (bizRef != null) {
            wrapper.eq("kb_id", bizRef);
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

    private AuditLogView toView(KbAuditLogEntity entity) {
        AuditLogView view = new AuditLogView();
        view.setId(entity.getId());
        view.setTenantCode(entity.getTenantCode());
        view.setType(entity.getKbId() == null ? TYPE_SYS : TYPE_KB);
        view.setBizRef(entity.getKbId());
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
