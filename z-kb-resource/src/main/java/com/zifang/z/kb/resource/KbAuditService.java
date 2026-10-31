package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.kb.storage.resource.entity.KbAuditLogEntity;
import com.zifang.z.kb.storage.resource.mapper.KbActivityRow;
import com.zifang.z.kb.storage.resource.mapper.KbAuditLogMapper;

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
 * 知识库审计与活跃度：成功写操作落 zkb_audit_log，热力图按库 + 自然日聚合。
 */
public class KbAuditService {

    private static final int DEFAULT_DAYS = 168;
    private static final int MAX_DAYS = 365;
    private static final int MAX_DETAIL_LENGTH = 1000;

    private final KbAuditLogMapper auditLogMapper;

    public KbAuditService(KbAuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
    }

    /** 记录一次成功写操作（失败操作不落库，避免污染活跃度）。 */
    public void record(KbCaller caller, String kbId, String action,
                       String targetType, String targetId, String detail) {
        KbAuditLogEntity entity = new KbAuditLogEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setTenantCode(caller.getTenantCode());
        entity.setKbId(kbId);
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
                                                                 List<String> kbIds, int days) {
        List<String> ids = normalizeIds(kbIds);
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        int window = days <= 0 ? DEFAULT_DAYS : Math.min(days, MAX_DAYS);
        LocalDate startDate = LocalDate.now().minusDays(window - 1L);
        Instant start = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant();

        Map<String, List<KnowledgeBaseActivityPoint>> result = new LinkedHashMap<>();
        for (KbActivityRow row : auditLogMapper.countByDay(tenantCode, ids, start)) {
            if (row.getKbId() == null || row.getActDate() == null) {
                continue;
            }
            result.computeIfAbsent(row.getKbId(), key -> new ArrayList<>())
                    .add(new KnowledgeBaseActivityPoint(row.getActDate().toString(),
                            row.getTotal() == null ? 0L : row.getTotal()));
        }
        for (List<KnowledgeBaseActivityPoint> points : result.values()) {
            points.sort(Comparator.comparing(KnowledgeBaseActivityPoint::getDate));
        }
        return result;
    }

    private List<String> normalizeIds(List<String> kbIds) {
        if (kbIds == null || kbIds.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String kbId : kbIds) {
            if (kbId != null && !kbId.trim().isEmpty()) {
                unique.add(kbId.trim());
            }
        }
        return new ArrayList<>(unique);
    }
}
