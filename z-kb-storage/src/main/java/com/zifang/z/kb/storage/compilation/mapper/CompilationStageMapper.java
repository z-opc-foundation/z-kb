package com.zifang.z.kb.storage.compilation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.kb.storage.compilation.entity.CompilationStageEntity;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CompilationStageMapper extends BaseMapper<CompilationStageEntity> {

    /** 按知识库分页读取阶段执行件（任务监控视图），可按阶段与状态过滤。 */
    @Select({"<script>",
            "SELECT s.id AS taskId, s.stage AS taskType, s.material_version_id AS bizKey,",
            " s.status AS status, s.round_no AS attempt, 1 AS maxAttempts,",
            " s.detail AS resultSummary, s.failure_summary AS failureSummary,",
            " s.material_id AS materialId, m.title AS materialTitle,",
            " s.create_time AS createTime, s.started_at AS startedAt, s.finished_at AS finishedAt",
            " FROM zkb_compilation_stage s",
            " JOIN zkb_compilation_job j ON j.job_id = s.job_id",
            " AND j.tenant_code = s.tenant_code AND j.is_deleted = 0",
            " LEFT JOIN zkb_material m ON m.tenant_code = s.tenant_code",
            " AND m.material_id = s.material_id AND m.is_deleted = 0",
            " WHERE s.tenant_code = #{tenantCode} AND s.is_deleted = 0 AND j.kb_id = #{kbId}",
            "<if test='taskType != null'> AND s.stage = #{taskType}</if>",
            "<if test='status != null'> AND s.status = #{status}</if>",
            " ORDER BY s.create_time DESC, s.id DESC LIMIT #{limit} OFFSET #{offset}",
            "</script>"})
    List<TaskMonitorRow> pageByKb(@Param("tenantCode") String tenantCode,
                                 @Param("kbId") String kbId,
                                 @Param("taskType") String taskType,
                                 @Param("status") String status,
                                 @Param("limit") int limit,
                                 @Param("offset") int offset);

    /** 统计知识库内符合条件的阶段执行件数量。 */
    @Select({"<script>",
            "SELECT COUNT(*) FROM zkb_compilation_stage s",
            " JOIN zkb_compilation_job j ON j.job_id = s.job_id",
            " AND j.tenant_code = s.tenant_code AND j.is_deleted = 0",
            " WHERE s.tenant_code = #{tenantCode} AND s.is_deleted = 0 AND j.kb_id = #{kbId}",
            "<if test='taskType != null'> AND s.stage = #{taskType}</if>",
            "<if test='status != null'> AND s.status = #{status}</if>",
            "</script>"})
    long countByKb(@Param("tenantCode") String tenantCode,
                   @Param("kbId") String kbId,
                   @Param("taskType") String taskType,
                   @Param("status") String status);
}
