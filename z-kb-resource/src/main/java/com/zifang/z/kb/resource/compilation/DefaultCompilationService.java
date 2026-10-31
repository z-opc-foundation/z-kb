package com.zifang.z.kb.resource.compilation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.kb.api.compilation.ArtifactType;
import com.zifang.z.kb.api.compilation.ArtifactView;
import com.zifang.z.kb.api.compilation.BatchScopeType;
import com.zifang.z.kb.api.compilation.CompilationJobView;
import com.zifang.z.kb.api.compilation.CompilationScopeParam;
import com.zifang.z.kb.api.compilation.CompilationScopeView;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.compilation.CompilationStage;
import com.zifang.z.kb.api.compilation.CompilationStageView;
import com.zifang.z.kb.api.compilation.JobRunStatus;
import com.zifang.z.kb.api.compilation.Milestone;
import com.zifang.z.kb.api.compilation.RetrievalChunkView;
import com.zifang.z.kb.api.compilation.RetrievalState;
import com.zifang.z.kb.api.compilation.TaskRunStatus;
import com.zifang.z.kb.api.material.MaterialCompileSource;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.storage.compilation.entity.ArtifactEntity;
import com.zifang.z.kb.storage.compilation.entity.ArtifactVersionEntity;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.entity.CompilationStageEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.compilation.mapper.CompilationStageMapper;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static com.zifang.z.kb.resource.compilation.CompilationSupport.CONFIG_VERSION;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.DEFAULT_CHUNK_PAGE;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.DEFAULT_JOB_LIST;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.DEFAULT_SEARCH_LIMIT;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.MAX_CHUNK_PAGE;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.MAX_JOB_LIST;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.MAX_SEARCH_LIMIT;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.PIPELINE_DOCUMENT;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.STAGES;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.TASK_CODE_COMPILE_FILE;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.TASK_TYPE_COMPILATION;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.hasText;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.jobNotFound;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.limit;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.messageOf;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.paramInvalid;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.scopeTypeOf;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.stageCode;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.statusInvalid;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.trimToNull;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.truncate;

/**
 * 编译编排默认实现：作业冻结输入，阶段按 P0–P4 同步执行并落库。
 *
 * <p>与参考实现的口径一致：单文件触发可复用运行中/已完成的作业，批次是多文件作业，
 * 阶段按物料版本分行，索引阶段产出检索块并发布产物。差异只在调度方式：z-kb 没有任务
 * 内核，返回时即是终态，而不是「已排队」。</p>
 */
public class DefaultCompilationService implements CompilationService {

    private static final DateTimeFormatter NAME_FORMATTER =
            DateTimeFormatter.ofPattern("MM-dd HH:mm");

    private final CompilationJobMapper jobMapper;
    private final CompilationStageMapper stageMapper;
    private final ArtifactMapper artifactMapper;
    private final ArtifactVersionMapper artifactVersionMapper;
    private final RetrievalChunkMapper chunkMapper;
    private final MaterialService materialService;
    private final KnowledgeBaseResourceService resourceService;
    private final CompilationStageRunner runner;

    public DefaultCompilationService(CompilationJobMapper jobMapper,
                                     CompilationStageMapper stageMapper,
                                     ArtifactMapper artifactMapper,
                                     ArtifactVersionMapper artifactVersionMapper,
                                     RetrievalChunkMapper chunkMapper,
                                     MaterialService materialService,
                                     KnowledgeBaseResourceService resourceService,
                                     CompilationStageRunner runner) {
        this.jobMapper = jobMapper;
        this.stageMapper = stageMapper;
        this.artifactMapper = artifactMapper;
        this.artifactVersionMapper = artifactVersionMapper;
        this.chunkMapper = chunkMapper;
        this.materialService = materialService;
        this.resourceService = resourceService;
        this.runner = runner;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationJobView run(String materialId, String versionId, KbCaller caller) {
        if (!hasText(materialId)) {
            throw paramInvalid();
        }
        MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(),
                trimToNull(versionId), caller);
        resourceService.requireActionable(source.getKbId(), KnowledgeBaseAction.COMPILATION_RUN,
                caller);
        CompilationJobEntity reusable = reusableJob(caller.getTenantCode(), source);
        if (reusable != null) {
            return toView(reusable, true, true);
        }
        List<CompilationJson.ScopeEntry> entries = Collections.singletonList(entryOf(source));
        CompilationJobEntity job = newJob(caller, source.getKbId(), nameOf(source.getTitle()),
                TASK_TYPE_COMPILATION, BatchScopeType.SINGLE.name(), null, entries);
        jobMapper.insert(job);
        execute(job, Collections.singletonList(source), 0, caller);
        return toView(reload(job), true, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationJobView runScope(CompilationScopeParam param, KbCaller caller) {
        if (param == null || !hasText(param.getKbId()) || param.getMaterialIds() == null
                || param.getMaterialIds().isEmpty()) {
            throw paramInvalid();
        }
        String kbId = param.getKbId().trim();
        resourceService.requireActionable(kbId, KnowledgeBaseAction.COMPILATION_RUN, caller);
        List<MaterialCompileSource> sources = new ArrayList<>();
        for (int i = 0; i < param.getMaterialIds().size(); i++) {
            String materialId = param.getMaterialIds().get(i);
            if (!hasText(materialId)) {
                continue;
            }
            String versionId = param.getVersionIds() != null
                    && param.getVersionIds().size() > i ? param.getVersionIds().get(i) : null;
            MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(),
                    trimToNull(versionId), caller);
            if (!kbId.equals(source.getKbId())) {
                throw paramInvalid();
            }
            sources.add(source);
        }
        if (sources.isEmpty()) {
            throw paramInvalid();
        }
        String scopeType = scopeTypeOf(param.getScopeType());
        String name = nameOf(hasText(param.getName()) ? param.getName().trim() : null);
        String taskType = hasText(param.getTaskType()) ? param.getTaskType().trim()
                : TASK_TYPE_COMPILATION;
        List<CompilationJson.ScopeEntry> entries = new ArrayList<>();
        for (MaterialCompileSource source : sources) {
            entries.add(entryOf(source));
        }
        CompilationJobEntity job = newJob(caller, kbId, name, taskType, scopeType,
                trimToNull(param.getScopeId()), entries);
        jobMapper.insert(job);
        execute(job, sources, 0, caller);
        return toView(reload(job), true, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationJobView retry(String jobId, String startStage, KbCaller caller) {
        CompilationJobEntity job = requireJob(caller.getTenantCode(), jobId);
        resourceService.requireActionable(job.getKbId(), KnowledgeBaseAction.COMPILATION_RUN,
                caller);
        if (!JobRunStatus.isTerminal(job.getRunStatus())) {
            throw statusInvalid();
        }
        int startIndex = CompilationSupport.stageIndex(CompilationSupport.parseStartStage(startStage));
        List<CompilationJson.ScopeEntry> entries = CompilationJson.entries(job.getInputSnapshot());
        if (entries.isEmpty()) {
            throw statusInvalid();
        }
        List<MaterialCompileSource> sources = new ArrayList<>();
        for (CompilationJson.ScopeEntry entry : entries) {
            sources.add(materialService.loadCompileSource(entry.getMaterialId(),
                    trimToNull(entry.getVersionId()), caller));
        }
        job.setRoundNo(roundOf(job) + 1);
        execute(job, sources, startIndex, caller);
        return toView(reload(job), true, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationJobView cancel(String jobId, KbCaller caller) {
        CompilationJobEntity job = requireJob(caller.getTenantCode(), jobId);
        resourceService.requireActionable(job.getKbId(), KnowledgeBaseAction.COMPILATION_RUN,
                caller);
        if (JobRunStatus.isTerminal(job.getRunStatus())) {
            return toView(job, true, true);
        }
        Instant now = Instant.now();
        job.setRunStatus(JobRunStatus.CANCELED.name());
        job.setFinishedAt(now);
        job.setCurrentStage(null);
        job.setUpdateBy(caller.getActorId());
        job.setUpdateTime(now);
        jobMapper.updateById(job);
        stageMapper.update(null, new UpdateWrapper<CompilationStageEntity>()
                .eq("tenant_code", job.getTenantCode())
                .eq("job_id", job.getJobId())
                .eq("round_no", roundOf(job))
                .in("status", TaskRunStatus.PENDING.name(), TaskRunStatus.READY.name(),
                        TaskRunStatus.QUEUED.name(), TaskRunStatus.RUNNING.name())
                .set("status", TaskRunStatus.CANCELED.name())
                .set("finished_at", now)
                .set("update_by", caller.getActorId())
                .set("update_time", now));
        return toView(reload(job), true, false);
    }

    @Override
    public CompilationJobView queryByMaterial(String materialId, String versionId, KbCaller caller) {
        if (!hasText(materialId)) {
            throw paramInvalid();
        }
        MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(),
                trimToNull(versionId), caller);
        CompilationStageEntity latest = latestStage(caller.getTenantCode(), source.getVersionId());
        if (latest == null) {
            return null;
        }
        CompilationJobEntity job = selectJob(caller.getTenantCode(), latest.getJobId());
        if (job == null || !containsVersion(job, source.getVersionId())) {
            return null;
        }
        return toView(job, true, false);
    }

    @Override
    public CompilationJobView queryByJobId(String jobId, KbCaller caller) {
        CompilationJobEntity job = requireJob(caller.getTenantCode(), jobId);
        resourceService.requireReadable(job.getKbId(), caller);
        return toView(job, true, false);
    }

    @Override
    public List<CompilationScopeView> listScope(String jobId, KbCaller caller) {
        CompilationJobEntity job = requireJob(caller.getTenantCode(), jobId);
        resourceService.requireReadable(job.getKbId(), caller);
        List<CompilationScopeView> result = new ArrayList<>();
        for (CompilationJson.ScopeEntry entry : CompilationJson.entries(job.getInputSnapshot())) {
            CompilationScopeView view = new CompilationScopeView();
            view.setMaterialId(entry.getMaterialId());
            view.setMaterialVersionId(entry.getVersionId());
            view.setTitle(entry.getTitle());
            result.add(view);
        }
        return result;
    }

    @Override
    public List<CompilationJobView> listByKb(String kbId, String materialId, int limit,
                                             KbCaller caller) {
        if (!hasText(kbId)) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId.trim(), caller);
        List<CompilationJobView> result = new ArrayList<>();
        if (hasText(materialId)) {
            CompilationJobView info = queryByMaterial(materialId.trim(), null, caller);
            if (info != null && kbId.trim().equals(info.getKbId())) {
                result.add(info);
            }
            return result;
        }
        int size = limit(limit, DEFAULT_JOB_LIST, MAX_JOB_LIST);
        QueryWrapper<CompilationJobEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode()).eq("kb_id", kbId.trim())
                .eq("is_deleted", 0)
                .orderByDesc("create_time").orderByDesc("id")
                .last("LIMIT " + size);
        for (CompilationJobEntity job : jobMapper.selectList(query)) {
            if (CompilationJson.entries(job.getInputSnapshot()).isEmpty()) {
                continue;
            }
            result.add(toView(job, false, false));
        }
        return result;
    }

    @Override
    public List<RetrievalChunkView> listChunks(String materialId, String versionId, int limit,
                                               KbCaller caller) {
        if (!hasText(materialId)) {
            throw paramInvalid();
        }
        MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(),
                trimToNull(versionId), caller);
        int size = limit(limit, DEFAULT_CHUNK_PAGE, MAX_CHUNK_PAGE);
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode())
                .eq("material_version_id", source.getVersionId())
                .eq("chunk_role", com.zifang.z.kb.api.compilation.ChunkRole.PASSAGE.name())
                .eq("is_deleted", 0)
                .orderByAsc("ordinal")
                .last("LIMIT " + size);
        List<RetrievalChunkView> result = new ArrayList<>();
        for (RetrievalChunkEntity chunk : chunkMapper.selectList(query)) {
            result.add(CompilationSupport.toChunkView(chunk));
        }
        return result;
    }

    @Override
    public List<RetrievalChunkView> search(String kbId, String keyword, int limit,
                                           KbCaller caller) {
        if (!hasText(kbId)) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId.trim(), caller);
        int size = limit(limit, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode()).eq("kb_id", kbId.trim())
                .eq("chunk_role", com.zifang.z.kb.api.compilation.ChunkRole.PASSAGE.name())
                .eq("index_state", RetrievalState.INDEXED.name())
                .eq("is_deleted", 0);
        if (hasText(keyword)) {
            String trimmed = keyword.trim();
            query.and(wrapper -> wrapper.like("content", trimmed).or().like("heading", trimmed));
        }
        query.orderByAsc("material_id").orderByAsc("ordinal").last("LIMIT " + size);
        List<RetrievalChunkView> result = new ArrayList<>();
        for (RetrievalChunkEntity chunk : chunkMapper.selectList(query)) {
            result.add(CompilationSupport.toChunkView(chunk));
        }
        return result;
    }

    /**
     * 执行作业：逐文件、逐阶段推进；阶段异常落成 FAILED 行后中止该文件，不影响其它文件。
     * 返回时作业已是终态。
     */
    private void execute(CompilationJobEntity job, List<MaterialCompileSource> sources,
                         int startIndex, KbCaller caller) {
        Instant started = Instant.now();
        job.setRunStatus(JobRunStatus.RUNNING.name());
        if (job.getStartedAt() == null) {
            job.setStartedAt(started);
        }
        job.setFinishedAt(null);
        job.setFailureSummary(null);
        job.setUpdateBy(caller.getActorId());
        job.setUpdateTime(started);
        jobMapper.updateById(job);

        int round = roundOf(job);
        int success = 0;
        int failed = 0;
        int chunkCount = 0;
        Instant m1At = null;
        Instant m2At = null;
        String failureSummary = null;

        for (MaterialCompileSource source : sources) {
            boolean ok = true;
            for (int i = 0; i < STAGES.length; i++) {
                CompilationStage stage = STAGES[i];
                CompilationStageEntity row = openStageRow(job, source, round, stage, i, caller);
                if (i < startIndex) {
                    row.setStatus(TaskRunStatus.SKIPPED.name());
                    row.setDetail("已跳过：本次从 " + stageCode(startIndex) + " 重跑");
                    row.setStartedAt(null);
                    row.setFinishedAt(Instant.now());
                    row.setUpdateTime(row.getFinishedAt());
                    stageMapper.updateById(row);
                    continue;
                }
                Instant stageStart = Instant.now();
                row.setStatus(TaskRunStatus.RUNNING.name());
                row.setStartedAt(stageStart);
                row.setFinishedAt(null);
                row.setFailureSummary(null);
                row.setUpdateTime(stageStart);
                stageMapper.updateById(row);
                job.setCurrentStage(stage.name());
                job.setUpdateTime(stageStart);
                jobMapper.updateById(job);
                try {
                    CompilationStageRunner.Outcome outcome = runner.execute(job, stage, source, caller);
                    row.setStatus(TaskRunStatus.SUCCEEDED.name());
                    row.setOutputRef(outcome.getArtifactId());
                    row.setItemCount(outcome.getItemCount());
                    row.setDetail(truncate(outcome.getDetail(), 1000));
                    row.setFinishedAt(Instant.now());
                    row.setUpdateTime(row.getFinishedAt());
                    stageMapper.updateById(row);
                    if (stage == CompilationStage.CHUNK) {
                        chunkCount += outcome.getItemCount();
                    }
                    if (stage == CompilationStage.INDEX && m1At == null) {
                        m1At = row.getFinishedAt();
                    }
                } catch (RuntimeException e) {
                    Instant stageEnd = Instant.now();
                    String message = messageOf(e);
                    row.setStatus(TaskRunStatus.FAILED.name());
                    row.setFailureSummary(truncate(message, 1000));
                    row.setDetail(truncate(message, 1000));
                    row.setFinishedAt(stageEnd);
                    row.setUpdateTime(stageEnd);
                    stageMapper.updateById(row);
                    failureSummary = "物料 " + source.getTitle() + " 编译失败：" + message;
                    ok = false;
                    break;
                }
            }
            if (ok) {
                success++;
                m2At = Instant.now();
            } else {
                failed++;
            }
        }

        job.setRunStatus(failed == 0 ? JobRunStatus.COMPLETED.name() : JobRunStatus.FAILED.name());
        job.setTotalCount(sources.size());
        job.setSuccessCount(success);
        job.setFailedCount(failed);
        job.setChunkCount(chunkCount);
        job.setM1At(m1At);
        job.setM2At(m2At);
        job.setMilestone(m2At != null ? Milestone.M2.name()
                : (m1At != null ? Milestone.M1.name() : Milestone.NONE.name()));
        job.setCurrentStage(null);
        job.setFinishedAt(Instant.now());
        job.setFailureSummary(truncate(failureSummary, 1000));
        job.setUpdateBy(caller.getActorId());
        job.setUpdateTime(job.getFinishedAt());
        jobMapper.updateById(job);
    }

    private CompilationStageEntity openStageRow(CompilationJobEntity job,
                                                MaterialCompileSource source, int round,
                                                CompilationStage stage, int seqNo,
                                                KbCaller caller) {
        QueryWrapper<CompilationStageEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", job.getTenantCode()).eq("job_id", job.getJobId())
                .eq("material_version_id", source.getVersionId())
                .eq("stage", stage.name()).eq("round_no", round).eq("is_deleted", 0)
                .last("LIMIT 1");
        CompilationStageEntity row = stageMapper.selectOne(query);
        if (row != null) {
            return row;
        }
        Instant now = Instant.now();
        row = new CompilationStageEntity();
        row.setId(UUID.randomUUID().toString());
        row.setTenantCode(job.getTenantCode());
        row.setJobId(job.getJobId());
        row.setMaterialId(source.getMaterialId());
        row.setMaterialVersionId(source.getVersionId());
        row.setStage(stage.name());
        row.setStatus(TaskRunStatus.PENDING.name());
        row.setRoundNo(round);
        row.setSeqNo(seqNo);
        row.setItemCount(0);
        row.setIsDeleted(0);
        row.setCreateBy(caller.getActorId());
        row.setUpdateBy(caller.getActorId());
        row.setCreateTime(now);
        row.setUpdateTime(now);
        stageMapper.insert(row);
        return row;
    }

    /** 该物料版本已有运行中或已完成作业时复用，失败或取消的不复用。 */
    private CompilationJobEntity reusableJob(String tenant, MaterialCompileSource source) {
        CompilationStageEntity latest = latestStage(tenant, source.getVersionId());
        if (latest == null) {
            return null;
        }
        CompilationJobEntity job = selectJob(tenant, latest.getJobId());
        if (job == null || !source.getKbId().equals(job.getKbId())
                || !containsVersion(job, source.getVersionId())) {
            return null;
        }
        if (JobRunStatus.QUEUED.name().equals(job.getRunStatus())
                || JobRunStatus.RUNNING.name().equals(job.getRunStatus())
                || JobRunStatus.COMPLETED.name().equals(job.getRunStatus())) {
            return job;
        }
        return null;
    }

    private boolean containsVersion(CompilationJobEntity job, String versionId) {
        for (CompilationJson.ScopeEntry entry : CompilationJson.entries(job.getInputSnapshot())) {
            if (entry.getVersionId() != null && entry.getVersionId().equals(versionId)) {
                return true;
            }
        }
        return false;
    }

    private CompilationStageEntity latestStage(String tenant, String versionId) {
        if (!hasText(versionId)) {
            return null;
        }
        QueryWrapper<CompilationStageEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", versionId).eq("is_deleted", 0)
                .orderByDesc("create_time").orderByDesc("id").last("LIMIT 1");
        return stageMapper.selectOne(query);
    }

    private CompilationJobEntity requireJob(String tenant, String jobId) {
        if (!hasText(jobId)) {
            throw jobNotFound();
        }
        CompilationJobEntity job = selectJob(tenant, jobId.trim());
        if (job == null) {
            throw jobNotFound();
        }
        return job;
    }

    private CompilationJobEntity selectJob(String tenant, String jobId) {
        if (!hasText(jobId)) {
            return null;
        }
        QueryWrapper<CompilationJobEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("job_id", jobId.trim()).eq("is_deleted", 0)
                .last("LIMIT 1");
        return jobMapper.selectOne(query);
    }

    private CompilationJobEntity reload(CompilationJobEntity job) {
        CompilationJobEntity fresh = jobMapper.selectById(job.getId());
        return fresh == null ? job : fresh;
    }

    private CompilationJobEntity newJob(KbCaller caller, String kbId, String name, String taskType,
                                        String scopeType, String scopeId,
                                        List<CompilationJson.ScopeEntry> entries) {
        Instant now = Instant.now();
        CompilationJobEntity job = new CompilationJobEntity();
        String id = UUID.randomUUID().toString();
        job.setId(id);
        job.setJobId(id);
        job.setTenantCode(caller.getTenantCode());
        job.setKbId(kbId);
        job.setName(truncate(name, 255));
        job.setTaskType(hasText(taskType) ? taskType : TASK_TYPE_COMPILATION);
        job.setScopeType(scopeType);
        job.setScopeId(scopeId);
        job.setScopeCount(entries.size());
        job.setMaterialId(entries.get(0).getMaterialId());
        job.setMaterialVersionId(entries.get(0).getVersionId());
        job.setTotalCount(entries.size());
        job.setSuccessCount(0);
        job.setFailedCount(0);
        job.setInputSnapshot(CompilationJson.inputSnapshot(entries));
        job.setPipelineType(PIPELINE_DOCUMENT);
        job.setConfigVersion(CONFIG_VERSION);
        job.setConfigSnapshot(CompilationJson.taskConfig(TASK_CODE_COMPILE_FILE, name, taskType,
                CONFIG_VERSION));
        job.setCompilerVersion(CompilationSupport.COMPILER_VERSION);
        job.setRunStatus(JobRunStatus.QUEUED.name());
        job.setMilestone(Milestone.NONE.name());
        job.setChunkCount(0);
        job.setRoundNo(1);
        job.setIsDeleted(0);
        job.setCreateBy(caller.getActorId());
        job.setUpdateBy(caller.getActorId());
        job.setCreateTime(now);
        job.setUpdateTime(now);
        return job;
    }

    private CompilationJobView toView(CompilationJobEntity job, boolean withDetail, boolean reused) {
        List<CompilationJson.ScopeEntry> entries = CompilationJson.entries(job.getInputSnapshot());
        List<CompilationStageEntity> stages = CompilationSupport.roundStages(stageMapper,
                job.getTenantCode(), job.getJobId(), roundOf(job));
        CompilationJobView view = new CompilationJobView();
        view.setJobId(job.getJobId());
        view.setKbId(job.getKbId());
        view.setName(job.getName());
        view.setTaskType(job.getTaskType());
        view.setScopeType(job.getScopeType());
        view.setScopeId(job.getScopeId());
        view.setScopeCount(job.getScopeCount());
        view.setTotalCount(job.getTotalCount());
        view.setSuccessCount(job.getSuccessCount());
        view.setFailedCount(job.getFailedCount());
        if (!entries.isEmpty()) {
            view.setMaterialId(entries.get(0).getMaterialId());
            view.setMaterialVersionId(entries.get(0).getVersionId());
        }
        view.setPipelineType(job.getPipelineType());
        view.setConfigVersion(job.getConfigVersion());
        view.setConfigSnapshot(job.getConfigSnapshot());
        view.setCompilerVersion(job.getCompilerVersion());
        view.setRunStatus(job.getRunStatus());
        view.setStartedAt(job.getStartedAt());
        view.setFinishedAt(job.getFinishedAt());
        view.setFailureSummary(job.getFailureSummary());
        view.setUpdateTime(job.getUpdateTime());
        view.setReused(reused);
        fillMilestone(view, stages);
        view.setChunkCount(chunkCountOf(stages));
        if (!withDetail) {
            return view;
        }
        fillActiveTask(view, stages);
        if (!entries.isEmpty()) {
            List<CompilationStageEntity> firstStages = CompilationSupport.versionStages(stages,
                    entries.get(0).getVersionId());
            for (CompilationStageEntity row : firstStages) {
                view.getStages().add(toStageView(row));
            }
            view.setArtifact(artifactOf(job.getTenantCode(), entries.get(0).getVersionId()));
        }
        return view;
    }

    private CompilationStageView toStageView(CompilationStageEntity row) {
        CompilationStageView view = new CompilationStageView();
        view.setStage(row.getStage());
        view.setStatus(row.getStatus());
        view.setAttempt(row.getRoundNo());
        view.setInputRef(row.getInputRef());
        view.setOutputRef(row.getOutputRef());
        view.setDetail(row.getDetail());
        view.setStartedAt(row.getStartedAt());
        view.setFinishedAt(row.getFinishedAt());
        return view;
    }

    /** 里程碑由本轮阶段行推导：索引成功为 M1，文件全部成功为 M2。 */
    private void fillMilestone(CompilationJobView view, List<CompilationStageEntity> stages) {
        Instant m1At = null;
        Instant m2At = null;
        String milestone = Milestone.NONE.name();
        for (List<CompilationStageEntity> rows : CompilationSupport.groupByVersion(stages).values()) {
            CompilationStageEntity index = CompilationSupport.stageRow(rows, CompilationStage.INDEX);
            if (index != null && TaskRunStatus.SUCCEEDED.name().equals(index.getStatus())
                    && m1At == null) {
                m1At = index.getFinishedAt();
                milestone = Milestone.M1.name();
            }
            if (CompilationSupport.versionSucceeded(rows)) {
                Instant finished = lastFinished(rows);
                if (finished != null) {
                    m2At = finished;
                }
                milestone = Milestone.M2.name();
            }
        }
        view.setM1At(m1At);
        view.setM2At(m2At);
        view.setMilestone(milestone);
    }

    private int chunkCountOf(List<CompilationStageEntity> stages) {
        int count = 0;
        for (List<CompilationStageEntity> rows : CompilationSupport.groupByVersion(stages).values()) {
            count += CompilationSupport.memberChunkCount(rows);
        }
        return count;
    }

    private Instant lastFinished(List<CompilationStageEntity> rows) {
        Instant last = null;
        for (CompilationStageEntity row : rows) {
            if (row.getFinishedAt() != null && (last == null || row.getFinishedAt().isAfter(last))) {
                last = row.getFinishedAt();
            }
        }
        return last;
    }

    private void fillActiveTask(CompilationJobView view, List<CompilationStageEntity> stages) {
        for (CompilationStageEntity row : stages) {
            if (TaskRunStatus.RUNNING.name().equals(row.getStatus())) {
                view.setTaskId(row.getId());
                view.setTaskStatus(row.getStatus());
                return;
            }
        }
        for (CompilationStageEntity row : stages) {
            if (TaskRunStatus.QUEUED.name().equals(row.getStatus())) {
                view.setTaskId(row.getId());
                view.setTaskStatus(row.getStatus());
                return;
            }
        }
    }

    /** 补检索块产物的当前版本信息，物料版本没有产物时留空。 */
    private ArtifactView artifactOf(String tenant, String materialVersionId) {
        QueryWrapper<ArtifactEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", materialVersionId)
                .eq("artifact_type", ArtifactType.RETRIEVAL_CHUNK.name()).eq("is_deleted", 0)
                .orderByAsc("create_time").last("LIMIT 1");
        ArtifactEntity artifact = artifactMapper.selectOne(query);
        if (artifact == null) {
            return null;
        }
        ArtifactView view = new ArtifactView();
        view.setArtifactId(artifact.getArtifactId());
        view.setArtifactType(artifact.getArtifactType());
        view.setTitle(artifact.getTitle());
        view.setLifecycleStatus(artifact.getLifecycleStatus());
        view.setRetrievalState(artifact.getRetrievalState());
        view.setCurrentVersionId(artifact.getCurrentVersionId());
        view.setEvidenceRef(artifact.getEvidenceRef());
        view.setPublishedAt(artifact.getPublishedAt());
        QueryWrapper<ArtifactVersionEntity> versionQuery = new QueryWrapper<>();
        versionQuery.eq("tenant_code", tenant).eq("artifact_id", artifact.getArtifactId())
                .eq("is_deleted", 0).orderByDesc("version_no").last("LIMIT 1");
        ArtifactVersionEntity version = artifactVersionMapper.selectOne(versionQuery);
        if (version != null) {
            view.setVersionNo(version.getVersionNo());
            view.setContentHash(version.getContentHash());
            view.setStorageRef(version.getStorageRef());
        }
        return view;
    }

    private CompilationJson.ScopeEntry entryOf(MaterialCompileSource source) {
        return new CompilationJson.ScopeEntry(source.getMaterialId(), source.getVersionId(),
                truncate(source.getTitle(), 255), source.getVersionNo());
    }

    private int roundOf(CompilationJobEntity job) {
        return job.getRoundNo() == null ? 1 : job.getRoundNo();
    }

    /** 名称取物料标题，空标题回退为编译时间。 */
    private String nameOf(String value) {
        return hasText(value) ? value.trim()
                : "知识编译 · " + NAME_FORMATTER.format(LocalDateTime.ofInstant(Instant.now(),
                ZoneId.systemDefault()));
    }
}
