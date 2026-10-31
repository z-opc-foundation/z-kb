package com.zifang.z.kb.resource.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.compilation.TaskRunStatus;
import com.zifang.z.kb.api.evaluation.EvalDatasetStatus;
import com.zifang.z.kb.api.evaluation.EvalRunCreateParam;
import com.zifang.z.kb.api.evaluation.EvalRunStatus;
import com.zifang.z.kb.api.evaluation.EvalScopeType;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.api.evaluation.EvaluationStatusCode;
import com.zifang.z.kb.api.evaluation.RunSummaryInfo;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.taskconfig.TaskNature;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.resource.evaluation.EvaluationCaseScorer.ChunkCandidate;
import com.zifang.z.kb.resource.evaluation.EvaluationMetricCalculator.MetricComputation;
import com.zifang.z.kb.resource.evaluation.EvaluationSnapshotBuilder.SnapshotBuild;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseResultEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalDatasetEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalRunEntity;
import com.zifang.z.kb.storage.evaluation.entity.KbSnapshotEntity;
import com.zifang.z.kb.storage.evaluation.entity.KbSnapshotItemEntity;
import com.zifang.z.kb.storage.evaluation.mapper.EvalCaseResultMapper;
import com.zifang.z.kb.storage.evaluation.mapper.EvalRunMapper;
import com.zifang.z.kb.storage.resource.entity.KnowledgeBaseProfileEntity;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.kb.storage.taskconfig.entity.TaskConfigEntity;
import com.zifang.z.kb.storage.taskconfig.mapper.TaskConfigMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.DEFAULT_MIN_SCORE;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.INDEX_COVERAGE_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.JUDGE_MODE;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.JUDGE_VERSION;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.MAX_CASES;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.MAX_SCAN;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.MAX_STATS_CHUNKS;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.PARSE_SUCCESS_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.RECALL_FLOOR_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.REASON_INDEX_LOW;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.REASON_PARSE_LOW;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.REASON_RECALL_LOW;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.REASON_TRUNCATED;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.REUSE_WINDOW_HOURS;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.TOP_K;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.clamp01;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.error;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.messageOf;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parsePlain;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parseScope;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.requireText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.sha256;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.toJson;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.truncate;

/**
 * 评测运行执行：指纹复用判断、快照成员内逐题评测、逐题结果与坏例落库、指标持久化。
 *
 * <p>z-kb 编译期不算向量，候选块在评测时按正文现算本地哈希向量，只做内存计算不回写检索块。</p>
 */
final class EvaluationRunExecutor {

    private final KnowledgeBaseResourceService resourceService;

    private final KnowledgeBaseProfileMapper profileMapper;

    private final CompilationJobMapper jobMapper;

    private final TaskConfigMapper taskConfigMapper;

    private final EvalCaseResultMapper caseResultMapper;

    private final EvalRunMapper runMapper;

    private final LocalHashEmbedding embedding;

    private final EvaluationSnapshotBuilder snapshotBuilder;

    private final EvaluationCaseScorer caseScorer;

    private final EvaluationMetricCalculator metricCalculator;

    private final EvaluationBadcaseManager badcaseManager;

    private final EvaluationDatasetManager datasetManager;

    private final EvaluationQueryAssembler queryAssembler;

    EvaluationRunExecutor(KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper,
            CompilationJobMapper jobMapper,
            TaskConfigMapper taskConfigMapper,
            EvalCaseResultMapper caseResultMapper,
            EvalRunMapper runMapper,
            LocalHashEmbedding embedding,
            EvaluationSnapshotBuilder snapshotBuilder,
            EvaluationCaseScorer caseScorer,
            EvaluationMetricCalculator metricCalculator,
            EvaluationBadcaseManager badcaseManager,
            EvaluationDatasetManager datasetManager,
            EvaluationQueryAssembler queryAssembler) {
        this.resourceService = resourceService;
        this.profileMapper = profileMapper;
        this.jobMapper = jobMapper;
        this.taskConfigMapper = taskConfigMapper;
        this.caseResultMapper = caseResultMapper;
        this.runMapper = runMapper;
        this.embedding = embedding;
        this.snapshotBuilder = snapshotBuilder;
        this.caseScorer = caseScorer;
        this.metricCalculator = metricCalculator;
        this.badcaseManager = badcaseManager;
        this.datasetManager = datasetManager;
        this.queryAssembler = queryAssembler;
    }

    /** 创建并同步执行一次评测运行，含快照构建、指纹复用判断、逐题评测、指标落库与坏例更新。 */
    @Transactional(rollbackFor = Exception.class)
    RunSummaryInfo createRun(EvalRunCreateParam param, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        String actorId = caller.getActorId();
        if (param == null) {
            throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
        }
        String key = requireText(param.getKbId(), EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView kb = resourceService.requireActionable(key,
                KnowledgeBaseAction.COMPILATION_RUN, caller);
        EvalScopeType scope = parseScope(param.getScopeType());
        EvaluationStage stage = null;
        if (scope == EvalScopeType.STAGE) {
            stage = EvaluationStage.of(param.getStageCode());
            if (stage == null || !stage.isRunnable()) {
                throw error(EvaluationStatusCode.EVAL_STAGE_INVALID);
            }
        }
        EvalDatasetEntity dataset = param.getDatasetVersionNo() != null
                ? datasetManager.selectByVersion(tenantCode, kb.getKbId(),
                param.getDatasetVersionNo())
                : datasetManager.selectLatestFrozen(tenantCode, kb.getKbId());
        if (dataset == null) {
            throw error(EvaluationStatusCode.EVAL_DATASET_NOT_FOUND);
        }
        if (!EvalDatasetStatus.FROZEN.name().equals(dataset.getStatus())) {
            throw error(EvaluationStatusCode.EVAL_DATASET_STATUS_INVALID);
        }
        List<EvalCaseEntity> cases = datasetManager.activeCases(tenantCode, dataset.getId());
        if (cases.isEmpty()) {
            throw error(EvaluationStatusCode.EVAL_DATASET_EMPTY);
        }
        if (cases.size() > MAX_CASES) {
            throw error(EvaluationStatusCode.EVAL_DATASET_TOO_MANY);
        }
        Long busy = jobMapper.selectCount(new QueryWrapper<CompilationJobEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kb.getKbId())
                .in("run_status", TaskRunStatus.QUEUED.name(), TaskRunStatus.RUNNING.name())
                .eq("is_deleted", 0));
        if (busy != null && busy > 0) {
            throw error(EvaluationStatusCode.EVAL_RUN_BUSY);
        }
        KnowledgeBaseProfileEntity profile = profileMapper.selectOne(
                new QueryWrapper<KnowledgeBaseProfileEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kb.getKbId())
                        .last("LIMIT 1"));
        String configVersion = profile == null || profile.getConfigVersion() == null
                ? "1" : String.valueOf(profile.getConfigVersion()).trim();
        TaskConfigEntity taskConfig = taskConfigMapper.selectOne(
                new QueryWrapper<TaskConfigEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kb.getKbId())
                        .eq("task_type", TaskNature.EVALUATION.name())
                        .eq("is_deleted", 0)
                        .orderByDesc("published_at")
                        .last("LIMIT 1"));
        String taskConfigVersion = taskConfig == null || !hasText(taskConfig.getConfigVersion())
                ? "1" : taskConfig.getConfigVersion().trim();
        JudgeSettings judge = judgeSettings(taskConfig);
        String ontologyVersion = hasText(kb.getPrimaryGraphSpaceKey())
                ? kb.getPrimaryGraphSpaceKey()
                : (profile != null && hasText(profile.getPresetVersion())
                        ? profile.getPresetVersion() : "default");
        SnapshotBuild snapshot = snapshotBuilder.buildSnapshot(tenantCode, kb.getKbId(),
                configVersion, ontologyVersion, actorId);
        String fingerprint = runFingerprint(kb.getKbId(), dataset, configVersion,
                snapshot.snapshot, scope, stage);
        boolean allowReuse = param.getAllowReuse() == null || param.getAllowReuse();
        if (allowReuse) {
            EvalRunEntity reusable = selectReusableByFingerprint(tenantCode, kb.getKbId(),
                    fingerprint, Instant.now().minus(REUSE_WINDOW_HOURS, ChronoUnit.HOURS));
            if (reusable != null) {
                return queryAssembler.toRunSummary(reusable, true);
            }
        }
        String baselineRunId = hasText(param.getBaselineRunId())
                ? param.getBaselineRunId().trim() : null;
        if (baselineRunId != null) {
            EvalRunEntity baseline = queryAssembler.selectRunByRunId(tenantCode, baselineRunId);
            if (baseline == null || !kb.getKbId().equals(baseline.getKbId())) {
                throw error(EvaluationStatusCode.EVAL_RUN_NOT_FOUND);
            }
        }
        Instant now = Instant.now();
        EvalRunEntity run = new EvalRunEntity();
        run.setId(UUID.randomUUID().toString());
        run.setRunId(UUID.randomUUID().toString());
        run.setTenantCode(tenantCode);
        run.setKbId(kb.getKbId());
        run.setDatasetPk(dataset.getId());
        run.setDatasetId(dataset.getDatasetId());
        run.setDatasetVersionNo(dataset.getVersionNo());
        run.setSnapshotId(snapshot.snapshot.getSnapshotId());
        run.setConfigVersion(configVersion);
        run.setTaskConfigVersion(taskConfigVersion);
        run.setJudgeMode(JUDGE_MODE);
        run.setJudgeVersion(JUDGE_VERSION);
        run.setJudgeConfig(toJson(judge.config()));
        run.setRetrievalConfig(toJson(retrievalConfig(judge, scope, stage)));
        run.setIndexGeneration(snapshot.snapshot.getIndexGeneration());
        run.setInputFingerprint(fingerprint);
        run.setScopeType(scope.name());
        run.setStageCode(stage == null ? null : stage.name());
        run.setBaselineRunId(baselineRunId);
        run.setStatus(EvalRunStatus.RUNNING.name());
        run.setResultUsable(0);
        run.setCaseTotal(cases.size());
        run.setCaseDone(0);
        run.setRetrievalTruncated(0);
        run.setStartedAt(now);
        run.setTriggeredBy(actorId);
        run.setIsDeleted(0);
        run.setCreateBy(actorId);
        run.setUpdateBy(actorId);
        run.setCreateTime(now);
        run.setUpdateTime(now);
        runMapper.insert(run);

        long started = System.currentTimeMillis();
        try {
            RunExecution execution = executeRun(tenantCode, run, cases, snapshot, scope, stage,
                    judge, actorId);
            Instant finished = Instant.now();
            run.setStatus(EvalRunStatus.SUCCEEDED.name());
            run.setResultUsable(execution.usable ? 1 : 0);
            run.setUnusableReason(execution.unusableReason);
            run.setCaseDone(execution.outcomes.size());
            run.setRetrievalTruncated(execution.truncated ? 1 : 0);
            run.setFinishedAt(finished);
            run.setDurationMs(Math.max(0L, System.currentTimeMillis() - started));
            run.setUpdateBy(actorId);
            run.setUpdateTime(finished);
            runMapper.updateById(run);
        } catch (RuntimeException exception) {
            Instant finished = Instant.now();
            run.setStatus(EvalRunStatus.FAILED.name());
            run.setResultUsable(0);
            run.setFinishedAt(finished);
            run.setDurationMs(Math.max(0L, System.currentTimeMillis() - started));
            run.setErrorCode("EVAL_RUN_FAILED");
            run.setErrorMessage(truncate(messageOf(exception), 1000));
            run.setUpdateBy(actorId);
            run.setUpdateTime(finished);
            runMapper.updateById(run);
        }
        return queryAssembler.toRunSummary(run, false);
    }

    /** 在快照成员范围内加载分块并逐题评测，落库逐题结果与坏例，最后计算并持久化指标。 */
    private RunExecution executeRun(String tenantCode, EvalRunEntity run, List<EvalCaseEntity> cases,
            SnapshotBuild snapshot, EvalScopeType scope, EvaluationStage stage,
            JudgeSettings judge, String actorId) {
        List<KbSnapshotItemEntity> items = snapshot.items;
        Set<String> materialVersionIds = new LinkedHashSet<>();
        Set<String> materialIds = new LinkedHashSet<>();
        for (KbSnapshotItemEntity item : items) {
            if (hasText(item.getMaterialVersionId())) {
                materialVersionIds.add(item.getMaterialVersionId());
            }
            if (hasText(item.getMaterialId())) {
                materialIds.add(item.getMaterialId());
            }
        }
        List<RetrievalChunkEntity> statsChunks = snapshotBuilder.loadChunks(tenantCode,
                materialVersionIds, false, false, MAX_STATS_CHUNKS + 1);
        List<RetrievalChunkEntity> candidateChunks = snapshotBuilder.loadChunks(tenantCode,
                materialVersionIds, true, true, MAX_SCAN + 1);
        boolean truncated = candidateChunks.size() > MAX_SCAN;
        if (truncated) {
            candidateChunks = new ArrayList<>(candidateChunks.subList(0, MAX_SCAN));
        }
        List<ChunkCandidate> candidates = new ArrayList<>();
        for (RetrievalChunkEntity chunk : candidateChunks) {
            if (!hasText(chunk.getContent())) {
                continue;
            }
            double[] vector = embedding.decode(chunk.getEmbedding());
            if (vector == null) {
                vector = embedding.embed(chunk.getContent());
            }
            ChunkCandidate candidate = new ChunkCandidate();
            candidate.chunk = chunk;
            candidate.vector = vector;
            candidates.add(candidate);
        }
        long totalChunks = snapshotBuilder.countChunks(tenantCode, materialVersionIds, false);
        long indexedChunks = snapshotBuilder.countChunks(tenantCode, materialVersionIds, true);
        double indexCoverage = totalChunks <= 0L ? 0.0d
                : clamp01((double) indexedChunks / (double) totalChunks);

        List<CaseOutcome> outcomes = new ArrayList<>();
        for (EvalCaseEntity evalCase : cases) {
            CaseOutcome outcome = caseScorer.evaluateCase(evalCase, candidates, statsChunks,
                    materialIds, materialVersionIds, judge);
            outcomes.add(outcome);
            persistCaseResult(tenantCode, run, outcome, actorId);
            badcaseManager.upsertBadcases(tenantCode, run, outcome, scope, stage, actorId);
        }

        MetricComputation computation = metricCalculator.computeMetrics(outcomes, statsChunks,
                totalChunks, indexCoverage, indexedChunks, truncated);
        boolean usable;
        String unusableReason;
        if (truncated) {
            usable = false;
            unusableReason = REASON_TRUNCATED;
        } else if (scope == EvalScopeType.STAGE) {
            usable = true;
            unusableReason = null;
        } else if (indexCoverage + 1.0e-9 < INDEX_COVERAGE_TARGET) {
            usable = false;
            unusableReason = REASON_INDEX_LOW;
        } else if (computation.parseSuccessRate + 1.0e-9 < PARSE_SUCCESS_TARGET) {
            usable = false;
            unusableReason = REASON_PARSE_LOW;
        } else if (computation.recallFloor != null
                && computation.recallFloor + 1.0e-9 < RECALL_FLOOR_TARGET) {
            usable = false;
            unusableReason = REASON_RECALL_LOW;
        } else {
            usable = true;
            unusableReason = null;
        }
        metricCalculator.persistMetrics(tenantCode, run, computation, scope, stage, actorId);
        RunExecution execution = new RunExecution();
        execution.outcomes = outcomes;
        execution.truncated = truncated;
        execution.usable = usable;
        execution.unusableReason = unusableReason;
        return execution;
    }

    /** 将单条用例的答案、检索命中、引用、指标与阶段追踪写入逐题结果表。 */
    private void persistCaseResult(String tenantCode, EvalRunEntity run, CaseOutcome outcome,
            String actorId) {
        Instant now = Instant.now();
        EvalCaseResultEntity row = new EvalCaseResultEntity();
        row.setId(UUID.randomUUID().toString());
        row.setRunId(run.getRunId());
        row.setTenantCode(tenantCode);
        row.setCaseId(outcome.evalCase.getCaseId());
        row.setQuestion(truncate(outcome.question, 2000));
        row.setAnswer(outcome.answer);
        row.setAnswerMode(outcome.answerMode);
        row.setRetrieved(toJson(caseScorer.retrievedList(outcome.hits)));
        row.setCitations(toJson(caseScorer.citationList(outcome.citations)));
        row.setMetrics(toJson(outcome.caseMetrics));
        row.setStageTrace(toJson(outcome.stageTrace));
        row.setLatencyMs(outcome.latencyMs);
        row.setErrorMessage(outcome.errorMessage);
        row.setIsDeleted(0);
        row.setCreateBy(actorId);
        row.setUpdateBy(actorId);
        row.setCreateTime(now);
        row.setUpdateTime(now);
        caseResultMapper.insert(row);
    }

    /** 查询 2 小时内同指纹且成功的可复用运行。 */
    private EvalRunEntity selectReusableByFingerprint(String tenantCode, String kbId,
            String fingerprint, Instant since) {
        return runMapper.selectOne(new QueryWrapper<EvalRunEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("input_fingerprint", fingerprint)
                .eq("status", EvalRunStatus.SUCCEEDED.name())
                .ge("finished_at", since)
                .eq("is_deleted", 0)
                .orderByDesc("create_time")
                .orderByDesc("id")
                .last("LIMIT 1"));
    }

    /** 从评测任务配置读取 minScore 与 topK，缺失或解析失败时回落到本地默认值。 */
    private JudgeSettings judgeSettings(TaskConfigEntity taskConfig) {
        JudgeSettings settings = new JudgeSettings();
        settings.minScore = DEFAULT_MIN_SCORE;
        settings.topK = TOP_K;
        if (taskConfig == null || !hasText(taskConfig.getExecutorConfig())) {
            return settings;
        }
        Object plain = parsePlain(taskConfig.getExecutorConfig());
        if (!(plain instanceof Map)) {
            return settings;
        }
        Map<?, ?> config = (Map<?, ?>) plain;
        Double minScore = number(config.get("minScore"));
        if (minScore == null) {
            minScore = number(config.get("retrievalMinScore"));
        }
        if (minScore != null) {
            settings.minScore = Math.max(0.0d, Math.min(1.0d, minScore));
        }
        Integer topK = integer(config.get("topK"));
        if (topK == null) {
            topK = integer(config.get("retrievalTopK"));
        }
        if (topK != null && topK > 0) {
            settings.topK = Math.min(topK, 50);
        }
        return settings;
    }

    /** 记录本次运行实际使用的检索参数：topK、最低分、扫描上限、范围、阶段与向量模型。 */
    private Map<String, Object> retrievalConfig(JudgeSettings judge, EvalScopeType scope,
            EvaluationStage stage) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("topK", judge.topK);
        config.put("minScore", judge.minScore);
        config.put("scanCap", MAX_SCAN);
        config.put("scopeType", scope.name());
        config.put("stageCode", stage == null ? null : stage.name());
        config.put("embeddingModel", embedding.model());
        return config;
    }

    /** 计算运行输入指纹，覆盖知识库、数据集、配置、Judge 版本、快照、范围与阶段，用于判断运行能否复用。 */
    private String runFingerprint(String kbId, EvalDatasetEntity dataset, String configVersion,
            KbSnapshotEntity snapshot, EvalScopeType scope, EvaluationStage stage) {
        return sha256(kbId + "|" + dataset.getId() + "|" + configVersion + "|" + JUDGE_VERSION
                + "|" + snapshot.getFingerprint() + "|" + scope.name() + "|"
                + (stage == null ? "" : stage.name()));
    }

    private static Double number(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String && hasText((String) value)) {
            try {
                return Double.valueOf(((String) value).trim());
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        return null;
    }

    private static Integer integer(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String && hasText((String) value)) {
            try {
                return Integer.valueOf(((String) value).trim());
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        return null;
    }

    private static final class RunExecution {

        List<CaseOutcome> outcomes;

        boolean truncated;

        boolean usable;

        String unusableReason;
    }
}
