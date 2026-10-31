package com.zifang.z.kb.resource.compilation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.BatchScopeType;
import com.zifang.z.kb.api.compilation.CompilationStage;
import com.zifang.z.kb.api.compilation.RetrievalChunkView;
import com.zifang.z.kb.api.compilation.TaskRunStatus;
import com.zifang.z.kb.storage.compilation.entity.CompilationStageEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationStageMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 编译域公共口径：阶段顺序、状态判定、范围解析与视图转换。
 */
final class CompilationSupport {

    static final CompilationStage[] STAGES = {CompilationStage.REGISTER, CompilationStage.PARSE,
            CompilationStage.CHUNK, CompilationStage.INDEX, CompilationStage.EXTRACT};

    static final String COMPILER_VERSION = "local-chunker-v2";

    static final String PIPELINE_DOCUMENT = "DOCUMENT";

    static final String TASK_TYPE_COMPILATION = "COMPILATION";

    static final String CONFIG_VERSION = "v1";

    static final String TASK_CODE_COMPILE_FILE = "COMPILE_FILE";

    static final int DEFAULT_JOB_LIST = 20;

    static final int MAX_JOB_LIST = 100;

    static final int DEFAULT_CHUNK_PAGE = 100;

    static final int MAX_CHUNK_PAGE = 500;

    static final int DEFAULT_SEARCH_LIMIT = 20;

    static final int MAX_SEARCH_LIMIT = 50;

    static final int DEFAULT_BATCH_LIST = 20;

    static final int MAX_BATCH_LIST = 100;

    static final int MAX_BATCH_MEMBERS = 200;

    private CompilationSupport() {
    }

    static KBException jobNotFound() {
        return new KBException("COMPILATION_JOB_NOT_FOUND", "编译任务不存在");
    }

    static KBException batchNotFound() {
        return new KBException("COMPILATION_BATCH_NOT_FOUND", "编译组别不存在");
    }

    static KBException sourceNotReady() {
        return new KBException("COMPILATION_SOURCE_NOT_READY", "物料尚未解析成功，不能编译");
    }

    static KBException paramInvalid() {
        return new KBException("COMPILATION_PARAM_INVALID", "编译参数不合法");
    }

    static KBException statusInvalid() {
        return new KBException("COMPILATION_STATUS_INVALID", "编译任务当前状态不允许该操作");
    }

    static KBException batchRunning() {
        return new KBException("COMPILATION_BATCH_RUNNING", "当前知识库存在运行中的编译组别");
    }

    static KBException scopeTypeInvalid() {
        return new KBException("COMPILATION_SCOPE_TYPE_INVALID",
                "编译范围不合法：scopeType 只支持 WORKSPACE / CATEGORY / FOLDER");
    }

    /** 空值默认工作台多选；单文件与未知值都视为范围不合法。 */
    static String scopeTypeOf(String scopeType) {
        if (!hasText(scopeType)) {
            return BatchScopeType.WORKSPACE.name();
        }
        String normalized = scopeType.trim().toUpperCase();
        if (BatchScopeType.WORKSPACE.name().equals(normalized)
                || BatchScopeType.CATEGORY.name().equals(normalized)
                || BatchScopeType.FOLDER.name().equals(normalized)) {
            return normalized;
        }
        throw scopeTypeInvalid();
    }

    /** 把 P0–P4 代号或阶段枚举名解析为编译阶段。 */
    static CompilationStage parseStartStage(String value) {
        if (!hasText(value)) {
            return CompilationStage.REGISTER;
        }
        String normalized = value.trim().toUpperCase();
        switch (normalized) {
            case "P0":
                return CompilationStage.REGISTER;
            case "P1":
                return CompilationStage.PARSE;
            case "P2":
                return CompilationStage.CHUNK;
            case "P3":
                return CompilationStage.INDEX;
            case "P4":
                return CompilationStage.EXTRACT;
            default:
                break;
        }
        try {
            return CompilationStage.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw paramInvalid();
        }
    }

    static int stageIndex(CompilationStage stage) {
        for (int i = 0; i < STAGES.length; i++) {
            if (STAGES[i] == stage) {
                return i;
            }
        }
        return 0;
    }

    static String stageCode(int index) {
        return "P" + index;
    }

    /** 限定返回值条数：缺省取默认值，上限截断。 */
    static int limit(int limit, int defaultValue, int max) {
        return limit <= 0 ? defaultValue : Math.min(limit, max);
    }

    static List<CompilationStageEntity> roundStages(CompilationStageMapper stageMapper,
                                                    String tenantCode, String jobId, int roundNo) {
        QueryWrapper<CompilationStageEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenantCode).eq("job_id", jobId)
                .eq("round_no", roundNo).eq("is_deleted", 0)
                .orderByAsc("seq_no").orderByAsc("material_version_id");
        return stageMapper.selectList(query);
    }

    static List<CompilationStageEntity> versionStages(List<CompilationStageEntity> rows,
                                                      String versionId) {
        List<CompilationStageEntity> result = new ArrayList<>();
        for (CompilationStageEntity row : rows) {
            if (versionId != null && versionId.equals(row.getMaterialVersionId())) {
                result.add(row);
            }
        }
        return result;
    }

    /** 按冻结顺序保留每个物料版本的一组阶段。 */
    static Map<String, List<CompilationStageEntity>> groupByVersion(
            List<CompilationStageEntity> rows) {
        Map<String, List<CompilationStageEntity>> grouped = new LinkedHashMap<>();
        for (CompilationStageEntity row : rows) {
            String versionId = row.getMaterialVersionId();
            if (versionId == null) {
                continue;
            }
            grouped.computeIfAbsent(versionId, key -> new ArrayList<>()).add(row);
        }
        return grouped;
    }

    static CompilationStageEntity stageRow(List<CompilationStageEntity> rows,
                                           CompilationStage stage) {
        if (rows == null) {
            return null;
        }
        for (CompilationStageEntity row : rows) {
            if (stage.name().equals(row.getStage())) {
                return row;
            }
        }
        return null;
    }

    /** 文件本轮成功：所有阶段都是成功或跳过（跳过来自重跑起点之前的阶段）。 */
    static boolean versionSucceeded(List<CompilationStageEntity> rows) {
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        for (CompilationStageEntity row : rows) {
            if (!TaskRunStatus.SUCCEEDED.name().equals(row.getStatus())
                    && !TaskRunStatus.SKIPPED.name().equals(row.getStatus())) {
                return false;
            }
        }
        return true;
    }

    static boolean hasStatus(List<CompilationStageEntity> rows, TaskRunStatus status) {
        for (CompilationStageEntity row : rows) {
            if (status.name().equals(row.getStatus())) {
                return true;
            }
        }
        return false;
    }

    /** 阶段状态映射为文件成员口径。 */
    static String memberStatus(List<CompilationStageEntity> rows) {
        if (rows == null || rows.isEmpty()) {
            return com.zifang.z.kb.api.compilation.JobRunStatus.QUEUED.name();
        }
        if (hasStatus(rows, TaskRunStatus.RUNNING)) {
            return com.zifang.z.kb.api.compilation.JobRunStatus.RUNNING.name();
        }
        if (hasStatus(rows, TaskRunStatus.FAILED)) {
            return com.zifang.z.kb.api.compilation.JobRunStatus.FAILED.name();
        }
        if (hasStatus(rows, TaskRunStatus.CANCELED)) {
            return com.zifang.z.kb.api.compilation.JobRunStatus.CANCELED.name();
        }
        if (versionSucceeded(rows)) {
            return com.zifang.z.kb.api.compilation.JobRunStatus.COMPLETED.name();
        }
        return com.zifang.z.kb.api.compilation.JobRunStatus.QUEUED.name();
    }

    /** 文件里程碑：全部成功为 M2，索引成功为 M1。 */
    static String memberMilestone(List<CompilationStageEntity> rows) {
        if (versionSucceeded(rows)) {
            return "M2";
        }
        CompilationStageEntity index = stageRow(rows, CompilationStage.INDEX);
        if (index != null && TaskRunStatus.SUCCEEDED.name().equals(index.getStatus())) {
            return "M1";
        }
        return "NONE";
    }

    /** 文件检索块数：取索引阶段产出条数。 */
    static int memberChunkCount(List<CompilationStageEntity> rows) {
        CompilationStageEntity index = stageRow(rows, CompilationStage.INDEX);
        if (index == null || !TaskRunStatus.SUCCEEDED.name().equals(index.getStatus())
                || index.getItemCount() == null) {
            return 0;
        }
        return index.getItemCount();
    }

    static String firstFailure(List<CompilationStageEntity> rows) {
        if (rows == null) {
            return null;
        }
        for (CompilationStageEntity row : rows) {
            if (hasText(row.getFailureSummary())) {
                return row.getFailureSummary();
            }
        }
        return null;
    }

    static RetrievalChunkView toChunkView(RetrievalChunkEntity chunk) {
        RetrievalChunkView view = new RetrievalChunkView();
        view.setChunkId(chunk.getChunkId());
        view.setMaterialId(chunk.getMaterialId());
        view.setMaterialVersionId(chunk.getMaterialVersionId());
        view.setArtifactId(chunk.getArtifactId());
        view.setOrdinal(chunk.getOrdinal());
        view.setHeading(chunk.getHeading());
        view.setContent(chunk.getContent());
        view.setCharCount(chunk.getCharCount());
        view.setIndexState(chunk.getIndexState());
        view.setIndexedAt(chunk.getIndexedAt());
        return view;
    }

    static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    static String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    static String messageOf(Throwable error) {
        String message = error == null ? null : error.getMessage();
        return hasText(message) ? message : (error == null ? "未知错误" : error.getClass().getSimpleName());
    }
}
