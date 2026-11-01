package com.zifang.z.***REMOVED***.storage.compilation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.***REMOVED***.storage.compilation.entity.CompilationStageEntity;
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
            " FROM ***REMOVED***_compilation_stage s",
            " JOIN ***REMOVED***_compilation_job j ON j.job_id = s.job_id",
            " AND j.tenant_code = s.tenant_code AND j.is_deleted = 0",
            " LEFT JOIN ***REMOVED***_material m ON m.tenant_code = s.tenant_code",
            " AND m.material_id = s.material_id AND m.is_deleted = 0",
            " WHERE s.tenant_code = #{tenantCode} AND s.is_deleted = 0 AND j.***REMOVED***_id = #{***REMOVED***Id}",
            "<if test='taskType != null'> AND s.stage = #{taskType}</if>",
            "<if test='status != null'> AND s.status = #{status}</if>",
            " ORDER BY s.create_time DESC, s.id DESC LIMIT #{limit} OFFSET #{offset}",
            "</script>"})
    List<TaskMonitorRow> pageBy***REMOVED***(@Param("tenantCode") String tenantCode,
                                 @Param("***REMOVED***Id") String ***REMOVED***Id,
                                 @Param("taskType") String taskType,
                                 @Param("status") String status,
                                 @Param("limit") int limit,
                                 @Param("offset") int offset);

    /** 统计知识库内符合条件的阶段执行件数量。 */
    @Select({"<script>",
            "SELECT COUNT(*) FROM ***REMOVED***_compilation_stage s",
            " JOIN ***REMOVED***_compilation_job j ON j.job_id = s.job_id",
            " AND j.tenant_code = s.tenant_code AND j.is_deleted = 0",
            " WHERE s.tenant_code = #{tenantCode} AND s.is_deleted = 0 AND j.***REMOVED***_id = #{***REMOVED***Id}",
            "<if test='taskType != null'> AND s.stage = #{taskType}</if>",
            "<if test='status != null'> AND s.status = #{status}</if>",
            "</script>"})
    long countBy***REMOVED***(@Param("tenantCode") String tenantCode,
                   @Param("***REMOVED***Id") String ***REMOVED***Id,
                   @Param("taskType") String taskType,
                   @Param("status") String status);
}
