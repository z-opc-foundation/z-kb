package com.zifang.z.kb.storage.resource.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.kb.storage.resource.entity.KbAuditLogEntity;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

public interface KbAuditLogMapper extends BaseMapper<KbAuditLogEntity> {

    /** 按知识库 + 自然日聚合成功操作数（H2/MySQL 通用的 CAST AS DATE）。 */
    @Select("<script>"
            + "SELECT kb_id AS kbId, CAST(created_at AS DATE) AS actDate, COUNT(*) AS total "
            + "FROM zkb_audit_log "
            + "WHERE tenant_code = #{tenantCode} AND success = TRUE AND created_at &gt;= #{start} "
            + "AND kb_id IN "
            + "<foreach collection='kbIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> "
            + "GROUP BY kb_id, CAST(created_at AS DATE)"
            + "</script>")
    List<KbActivityRow> countByDay(@Param("tenantCode") String tenantCode,
                                   @Param("kbIds") List<String> kbIds,
                                   @Param("start") Instant start);
}
