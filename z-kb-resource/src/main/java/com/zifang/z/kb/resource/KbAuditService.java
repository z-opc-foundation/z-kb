package com.zifang.z.***REMOVED***.resource;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.***REMOVED***.storage.resource.entity.***REMOVED***AuditLogEntity;
import com.zifang.z.***REMOVED***.storage.resource.mapper.***REMOVED***ActivityRow;
import com.zifang.z.***REMOVED***.storage.resource.mapper.***REMOVED***AuditLogMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 知识库审计与活跃度：成功写操作落 ***REMOVED***_audit_log，热力图按库 + 自然日聚合。
 */
public class ***REMOVED***AuditService {

    private static final int DEFAULT_DAYS = 168;
    private static final int MAX_DAYS = 365;
    private static final int MAX_DETAIL_LENGTH = 1000;

    private final ***REMOVED***AuditLogMapper auditLogMapper;

    public ***REMOVED***AuditService(***REMOVED***AuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
    }

    /** 记录一次成功写操作（失败操作不落库，避免污染活跃度）。 */
    public void record(***REMOVED***Caller caller, String ***REMOVED***Id, String action,
                       String targetType, String targetId, String detail) {
        ***REMOVED***AuditLogEntity entity = new ***REMOVED***AuditLogEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setTenantCode(caller.getTenantCode());
        entity.set***REMOVED***Id(***REMOVED***Id);
        entity.setActorId(caller.getActorId());
        entity.setAction(action);
        entity.setTargetType(targetType);
        entity.setTargetId(targetId);
        entity.setSuccess(Boolean.TRUE);
        entity.setDetail(detail == null || detail.length() <= MAX_DETAIL_LENGTH
                ? detail : detail.substring(0, MAX_DETAIL_LENGTH));
        entity.setCreatedAt(Instant.now());
        auditLogMapper.insert(entity);
    }

    /** 批量聚合近 days 天每日操作次数，结果按日期升序；days ≤ 0 默认 168，上限 365。 */
    public Map<String, List<KnowledgeBaseActivityPoint>> heatmap(String tenantCode,
                                                                 List<String> ***REMOVED***Ids, int days) {
        List<String> ids = normalizeIds(***REMOVED***Ids);
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        int window = days <= 0 ? DEFAULT_DAYS : Math.min(days, MAX_DAYS);
        LocalDate startDate = LocalDate.now().minusDays(window - 1L);
        Instant start = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant();

        Map<String, List<KnowledgeBaseActivityPoint>> result = new LinkedHashMap<>();
        for (***REMOVED***ActivityRow row : auditLogMapper.countByDay(tenantCode, ids, start)) {
            if (row.get***REMOVED***Id() == null || row.getActDate() == null) {
                continue;
            }
            result.computeIfAbsent(row.get***REMOVED***Id(), key -> new ArrayList<>())
                    .add(new KnowledgeBaseActivityPoint(row.getActDate().toString(),
                            row.getTotal() == null ? 0L : row.getTotal()));
        }
        for (List<KnowledgeBaseActivityPoint> points : result.values()) {
            points.sort(Comparator.comparing(KnowledgeBaseActivityPoint::getDate));
        }
        return result;
    }

    private List<String> normalizeIds(List<String> ***REMOVED***Ids) {
        if (***REMOVED***Ids == null || ***REMOVED***Ids.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String ***REMOVED***Id : ***REMOVED***Ids) {
            if (***REMOVED***Id != null && !***REMOVED***Id.trim().isEmpty()) {
                unique.add(***REMOVED***Id.trim());
            }
        }
        return new ArrayList<>(unique);
    }
}
