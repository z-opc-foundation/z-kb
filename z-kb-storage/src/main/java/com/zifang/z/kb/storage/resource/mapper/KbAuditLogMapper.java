package com.zifang.z.***REMOVED***.storage.resource.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.***REMOVED***.storage.resource.entity.***REMOVED***AuditLogEntity;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

public interface ***REMOVED***AuditLogMapper extends BaseMapper<***REMOVED***AuditLogEntity> {

    /** 按知识库 + 自然日聚合成功操作数（H2/MySQL 通用的 CAST AS DATE）。 */
    @Select("<script>"
            + "SELECT ***REMOVED***_id AS ***REMOVED***Id, CAST(created_at AS DATE) AS actDate, COUNT(*) AS total "
            + "FROM ***REMOVED***_audit_log "
            + "WHERE tenant_code = #{tenantCode} AND success = TRUE AND created_at &gt;= #{start} "
            + "AND ***REMOVED***_id IN "
            + "<foreach collection='***REMOVED***Ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> "
            + "GROUP BY ***REMOVED***_id, CAST(created_at AS DATE)"
            + "</script>")
    List<***REMOVED***ActivityRow> countByDay(@Param("tenantCode") String tenantCode,
                                   @Param("***REMOVED***Ids") List<String> ***REMOVED***Ids,
                                   @Param("start") Instant start);
}
