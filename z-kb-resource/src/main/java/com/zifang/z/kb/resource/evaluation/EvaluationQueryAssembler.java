package com.zifang.z.kb.resource.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.evaluation.BaselineMetricsInfo;
import com.zifang.z.kb.api.evaluation.EvalCaseResultInfo;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageInfo;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageParam;
import com.zifang.z.kb.api.evaluation.EvalMetricLayer;
import com.zifang.z.kb.api.evaluation.EvalMetricStatus;
import com.zifang.z.kb.api.evaluation.EvalRunQueryInfo;
import com.zifang.z.kb.api.evaluation.EvalRunStatus;
import com.zifang.z.kb.api.evaluation.EvalScopeType;
import com.zifang.z.kb.api.evaluation.EvalSnapshotStatus;
import com.zifang.z.kb.api.evaluation.EvaluationMetricCode;
import com.zifang.z.kb.api.evaluation.EvaluationMetricInfo;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.api.evaluation.EvaluationStageInfo;
import com.zifang.z.kb.api.evaluation.EvaluationStatusCode;
import com.zifang.z.kb.api.evaluation.RunBriefInfo;
import com.zifang.z.kb.api.evaluation.RunDetailInfo;
import com.zifang.z.kb.api.evaluation.RunSummaryInfo;
import com.zifang.z.kb.api.evaluation.TrustEvidenceInfo;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseResultEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalResultEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalRunEntity;
import com.zifang.z.kb.storage.evaluation.entity.KbSnapshotEntity;
import com.zifang.z.kb.storage.evaluation.mapper.EvalCaseMapper;
import com.zifang.z.kb.storage.evaluation.mapper.EvalCaseResultMapper;
import com.zifang.z.kb.storage.evaluation.mapper.EvalResultMapper;
import com.zifang.z.kb.storage.evaluation.mapper.EvalRunMapper;
import com.zifang.z.kb.storage.evaluation.mapper.KbSnapshotMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.INDEX_COVERAGE_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.MAX_PAGE_SIZE;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.NOTE_LOCAL;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.error;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.failingStages;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parseJson;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parseStageTrace;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.requireText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.round;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.runnableStages;

/**
 * 评测查询装配：运行详情、逐题分页、可信证据、阶段视图与基线差值。
 */
final class EvaluationQueryAssembler {

    private final KnowledgeBaseResourceService resourceService;

    private final EvalRunMapper runMapper;

    private final EvalResultMapper resultMapper;

    private final EvalCaseResultMapper caseResultMapper;

    private final EvalCaseMapper caseMapper;

    private final KbSnapshotMapper snapshotMapper;

    private final EvaluationBadcaseManager badcaseManager;

    EvaluationQueryAssembler(KnowledgeBaseResourceService resourceService,
            EvalRunMapper runMapper,
            EvalResultMapper resultMapper,
            EvalCaseResultMapper caseResultMapper,
            EvalCaseMapper caseMapper,
            KbSnapshotMapper snapshotMapper,
            EvaluationBadcaseManager badcaseManager) {
        this.resourceService = resourceService;
        this.runMapper = runMapper;
        this.resultMapper = resultMapper;
        this.caseResultMapper = caseResultMapper;
        this.caseMapper = caseMapper;
        this.snapshotMapper = snapshotMapper;
        this.badcaseManager = badcaseManager;
    }

    private static final Map<String, String> NOT_CONNECTED_LABELS;

    static {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put(EvaluationMetricCode.CONTEXT_FAITHFULNESS, "S3 语义增强未接入");
        labels.put(EvaluationMetricCode.RERANK_EFFECT, "S6 融合与精排未接入");
        labels.put(EvaluationMetricCode.FEEDBACK_REGRESSION, "S8 反馈回归未接入");
        labels.put(EvaluationMetricCode.COST_PER_RUN, "成本与队列深度未接入");
        labels.put(EvaluationMetricCode.BACKLOG_TASKS, "成本与队列深度未接入");
        NOT_CONNECTED_LABELS = Collections.unmodifiableMap(labels);
    }

    /** 查询运行详情，返回运行信息、四层指标、阶段状态、坏例统计与基线差值。 */
    EvalRunQueryInfo queryRun(String runId, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        EvalRunEntity run = requireRun(tenantCode, runId);
        resourceService.requireReadable(run.getKbId(), caller);
        List<EvalResultEntity> rows = resultsOfRun(tenantCode, run.getRunId());
        List<EvalCaseResultEntity> caseResults = caseResultsOfRun(tenantCode, run.getRunId());
        EvalRunQueryInfo info = new EvalRunQueryInfo();
        info.setRun(toRunDetail(run));
        List<EvaluationMetricInfo> metrics = toMetricInfos(rows);
        info.setMetrics(metrics);
        info.setStages(buildStages(run, rows, caseResults));
        info.setBadcaseCounts(badcaseManager.countBadcasesInternal(tenantCode, run.getKbId()));
        info.setEvidence(buildTrustEvidence(run, rows));
        EvalRunEntity baseline = loadBaseline(tenantCode, run.getKbId(), run.getBaselineRunId());
        boolean comparable = isComparable(run, baseline);
        info.setComparable(comparable);
        if (baseline != null) {
            List<EvalResultEntity> baselineRows = resultsOfRun(tenantCode, baseline.getRunId());
            BaselineMetricsInfo baselineInfo = new BaselineMetricsInfo();
            baselineInfo.setRunId(baseline.getRunId());
            baselineInfo.setFinishedAt(baseline.getFinishedAt());
            baselineInfo.setMetrics(toMetricInfos(baselineRows));
            info.setBaseline(baselineInfo);
            if (comparable) {
                applyDeltas(metrics, baselineRows);
            }
        }
        return info;
    }

    /** 分页查询运行下的逐题结果，可只保留失败题或按指定失败阶段过滤。 */
    EvalCaseResultPageInfo pageCaseResults(EvalCaseResultPageParam param, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        if (param == null || !hasText(param.getRunId())) {
            throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
        }
        EvalRunEntity run = requireRun(tenantCode, param.getRunId());
        resourceService.requireReadable(run.getKbId(), caller);
        String stageFilter = null;
        if (hasText(param.getStageCode())) {
            EvaluationStage stage = EvaluationStage.of(param.getStageCode());
            if (stage == null || !stage.isRunnable()) {
                throw error(EvaluationStatusCode.EVAL_STAGE_INVALID);
            }
            stageFilter = stage.name();
        }
        boolean onlyBad = param.getOnlyBad() != null && param.getOnlyBad();
        List<EvalCaseResultEntity> rows = caseResultsOfRun(tenantCode, run.getRunId());
        List<EvalCaseResultInfo> filtered = new ArrayList<>();
        for (EvalCaseResultEntity row : rows) {
            Map<String, String> trace = parseStageTrace(row.getStageTrace());
            List<String> badStages = failingStages(trace);
            if (onlyBad && badStages.isEmpty()) {
                continue;
            }
            if (stageFilter != null && !EvalMetricStatus.FAIL.name().equals(trace.get(stageFilter))) {
                continue;
            }
            EvalCaseResultInfo info = new EvalCaseResultInfo();
            info.setCaseId(row.getCaseId());
            EvalCaseEntity evalCase = caseMapper.selectOne(new QueryWrapper<EvalCaseEntity>()
                    .eq("tenant_code", tenantCode)
                    .eq("case_id", row.getCaseId())
                    .eq("is_deleted", 0));
            info.setCaseNo(evalCase == null || evalCase.getCaseNo() == null ? 0
                    : evalCase.getCaseNo());
            info.setQuestion(row.getQuestion());
            info.setAnswer(row.getAnswer());
            info.setAnswerMode(row.getAnswerMode());
            info.setMetrics(parseJson(row.getMetrics()));
            info.setRetrieved(parseJson(row.getRetrieved()));
            info.setCitations(parseJson(row.getCitations()));
            info.setStageTrace(parseJson(row.getStageTrace()));
            info.setLatencyMs(row.getLatencyMs());
            info.setErrorMessage(row.getErrorMessage());
            info.setBadcaseStages(badStages);
            filtered.add(info);
        }
        int current = param.getCurrent() == null ? 1 : Math.max(param.getCurrent(), 1);
        int size = param.getSize() == null ? 20 : Math.min(Math.max(param.getSize(), 1),
                MAX_PAGE_SIZE);
        int from = (current - 1) * size;
        EvalCaseResultPageInfo page = new EvalCaseResultPageInfo();
        page.setTotal(filtered.size());
        if (from >= filtered.size()) {
            page.setRecords(new ArrayList<>());
        } else {
            page.setRecords(new ArrayList<>(filtered.subList(from,
                    Math.min(from + size, filtered.size()))));
        }
        return page;
    }

    /** 查询运行的版本、覆盖、评分、逐题与复现五类可信证据。 */
    List<TrustEvidenceInfo> queryTrustEvidence(String runId, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        EvalRunEntity run = requireRun(tenantCode, runId);
        resourceService.requireReadable(run.getKbId(), caller);
        return buildTrustEvidence(run, resultsOfRun(tenantCode, run.getRunId()));
    }

    /** 按运行范围组装阶段视图，聚合各阶段指标、失败题数与阶段状态。 */
    private List<EvaluationStageInfo> buildStages(EvalRunEntity run, List<EvalResultEntity> rows,
            List<EvalCaseResultEntity> caseResults) {
        List<EvaluationStageInfo> stages = new ArrayList<>();
        List<EvaluationStage> selected = new ArrayList<>();
        if (EvalScopeType.STAGE.name().equals(run.getScopeType())) {
            EvaluationStage stage = EvaluationStage.of(run.getStageCode());
            if (stage != null) {
                selected.add(stage);
            }
        } else {
            selected.addAll(runnableStages());
        }
        Map<String, Integer> failing = new HashMap<>();
        for (EvalCaseResultEntity caseResult : caseResults) {
            Map<String, String> trace = parseStageTrace(caseResult.getStageTrace());
            for (Map.Entry<String, String> entry : trace.entrySet()) {
                if (EvalMetricStatus.FAIL.name().equals(entry.getValue())) {
                    failing.put(entry.getKey(), failing.getOrDefault(entry.getKey(), 0) + 1);
                }
            }
        }
        for (EvaluationStage stage : selected) {
            EvaluationStageInfo info = new EvaluationStageInfo();
            info.setStageCode(stage.name());
            info.setStageName(stage.getLabel());
            List<EvaluationMetricInfo> stageMetrics = new ArrayList<>();
            for (EvalResultEntity row : rows) {
                if (stage.name().equals(row.getStageCode())) {
                    stageMetrics.add(toMetricInfo(row));
                }
            }
            info.setMetrics(stageMetrics);
            info.setFailingCaseCount(failing.getOrDefault(stage.name(), 0));
            info.setStatus(stageStatus(stageMetrics));
            stages.add(info);
        }
        return stages;
    }

    /** 由阶段内指标状态汇总阶段状态：失败优先，其次部分可用，全部通过才算通过。 */
    private String stageStatus(List<EvaluationMetricInfo> metrics) {
        if (metrics.isEmpty()) {
            return EvalMetricStatus.NOT_APPLICABLE.name();
        }
        boolean fail = false;
        boolean partial = false;
        boolean pass = false;
        boolean notConnected = false;
        for (EvaluationMetricInfo metric : metrics) {
            if (EvalMetricStatus.FAIL.name().equals(metric.getStatus())) {
                fail = true;
            } else if (EvalMetricStatus.PARTIAL.name().equals(metric.getStatus())) {
                partial = true;
            } else if (EvalMetricStatus.NOT_CONNECTED.name().equals(metric.getStatus())) {
                notConnected = true;
            } else if (EvalMetricStatus.PASS.name().equals(metric.getStatus())) {
                pass = true;
            }
        }
        if (fail) {
            return EvalMetricStatus.FAIL.name();
        }
        if (!pass && !partial && notConnected) {
            return EvalMetricStatus.NOT_CONNECTED.name();
        }
        if (partial || notConnected) {
            return EvalMetricStatus.PARTIAL.name();
        }
        return pass ? EvalMetricStatus.PASS.name() : EvalMetricStatus.NOT_APPLICABLE.name();
    }

    /** 为当前指标回填基线值并计算差值，仅处理基线中存在同名指标的项。 */
    private void applyDeltas(List<EvaluationMetricInfo> current, List<EvalResultEntity> baselineRows) {
        Map<String, BigDecimal> baseline = new HashMap<>();
        for (EvalResultEntity row : baselineRows) {
            baseline.put(row.getMetricCode(), row.getMetricValue());
        }
        for (EvaluationMetricInfo metric : current) {
            BigDecimal base = baseline.get(metric.getMetricCode());
            if (base == null) {
                continue;
            }
            metric.setBaselineValue(base);
            if (metric.getValue() != null) {
                metric.setDelta(metric.getValue().subtract(base).setScale(6, RoundingMode.HALF_UP));
            }
        }
    }

    boolean isComparable(EvalRunEntity current, EvalRunEntity baseline) {
        if (current == null || baseline == null) {
            return false;
        }
        return EvalRunStatus.SUCCEEDED.name().equals(current.getStatus())
                && EvalRunStatus.SUCCEEDED.name().equals(baseline.getStatus())
                && Objects.equals(current.getDatasetPk(), baseline.getDatasetPk())
                && Objects.equals(current.getDatasetVersionNo(), baseline.getDatasetVersionNo())
                && Objects.equals(current.getConfigVersion(), baseline.getConfigVersion())
                && Objects.equals(current.getJudgeVersion(), baseline.getJudgeVersion())
                && Objects.equals(current.getScopeType(), baseline.getScopeType())
                && Objects.equals(current.getStageCode(), baseline.getStageCode());
    }

    boolean isUsable(EvalRunEntity run) {
        return run != null && run.getResultUsable() != null && run.getResultUsable() == 1;
    }

    /** 加载同知识库下的基线运行，入参为空或跨知识库时返回 null。 */
    EvalRunEntity loadBaseline(String tenantCode, String kbId, String baselineRunId) {
        if (!hasText(baselineRunId)) {
            return null;
        }
        EvalRunEntity baseline = selectRunByRunId(tenantCode, baselineRunId.trim());
        return baseline == null || !kbId.equals(baseline.getKbId()) ? null : baseline;
    }

    /** 生成版本、覆盖、评分、逐题与复现五类可信证据，说明运行结果的可采信程度。 */
    List<TrustEvidenceInfo> buildTrustEvidence(EvalRunEntity run, List<EvalResultEntity> rows) {
        String tenantCode = run.getTenantCode();
        List<TrustEvidenceInfo> evidence = new ArrayList<>();
        boolean versionReady = hasText(run.getSnapshotId())
                && hasText(run.getConfigVersion())
                && hasText(run.getJudgeVersion())
                && hasText(run.getIndexGeneration());
        evidence.add(evidence("VERSION", "版本证据", versionReady ? "READY" : "PARTIAL",
                "数据集 v" + run.getDatasetVersionNo() + " / 快照 " + run.getSnapshotId()
                        + " / 配置 " + run.getConfigVersion() + " / Judge " + run.getJudgeVersion()
                        + " / 索引代际 " + run.getIndexGeneration()));
        EvalResultEntity coverageRow = findMetric(rows, EvaluationMetricCode.INDEX_COVERAGE);
        double coverage = coverageRow == null || coverageRow.getMetricValue() == null ? 0.0d
                : coverageRow.getMetricValue().doubleValue();
        evidence.add(evidence("COVERAGE", "覆盖证据",
                coverage + 1.0e-9 >= INDEX_COVERAGE_TARGET ? "READY"
                        : (coverage > 0.0d ? "PARTIAL" : "MISSING"),
                "索引覆盖率 " + round(coverage) + "，目标 " + INDEX_COVERAGE_TARGET
                        + "，题目 " + run.getCaseTotal() + " 道"));
        evidence.add(evidence("SCORING", "评分证据", "PARTIAL",
                run.getJudgeMode() + " / " + run.getJudgeVersion() + "，" + NOTE_LOCAL));
        int caseResults = caseResultsOfRun(tenantCode, run.getRunId()).size();
        int caseTotal = run.getCaseTotal() == null ? 0 : run.getCaseTotal();
        evidence.add(evidence("CASE_TRACE", "逐题证据",
                caseTotal > 0 && caseResults >= caseTotal ? "READY" : "PARTIAL",
                "逐题结果 " + caseResults + " / " + caseTotal));
        KbSnapshotEntity snapshot = hasText(run.getSnapshotId())
                ? snapshotMapper.selectOne(new QueryWrapper<KbSnapshotEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("snapshot_id", run.getSnapshotId())
                        .eq("is_deleted", 0))
                : null;
        boolean reproducible = snapshot != null
                && EvalSnapshotStatus.READY.name().equals(snapshot.getStatus())
                && hasText(run.getInputFingerprint())
                && hasText(snapshot.getFingerprint())
                && (run.getRetrievalTruncated() == null || run.getRetrievalTruncated() == 0);
        evidence.add(evidence("REPRODUCE", "复现证据", reproducible ? "READY" : "PARTIAL",
                "输入指纹 " + run.getInputFingerprint() + " / 快照指纹 "
                        + (snapshot == null ? null : snapshot.getFingerprint())
                        + (run.getRetrievalTruncated() != null && run.getRetrievalTruncated() == 1
                                ? " / 检索扫描已截断" : "")));
        return evidence;
    }

    /** 构造一条可信证据条目。 */
    private TrustEvidenceInfo evidence(String code, String label, String status, String detail) {
        TrustEvidenceInfo info = new TrustEvidenceInfo();
        info.setCode(code);
        info.setLabel(label);
        info.setStatus(status);
        info.setDetail(detail);
        return info;
    }

    /** 在指标行中按指标编码查找对应记录，未找到返回 null。 */
    private EvalResultEntity findMetric(List<EvalResultEntity> rows, String code) {
        for (EvalResultEntity row : rows) {
            if (code.equals(row.getMetricCode())) {
                return row;
            }
        }
        return null;
    }

    /** 批量将指标实体转换为展示信息。 */
    private List<EvaluationMetricInfo> toMetricInfos(List<EvalResultEntity> rows) {
        List<EvaluationMetricInfo> infos = new ArrayList<>();
        for (EvalResultEntity row : rows) {
            infos.add(toMetricInfo(row));
        }
        return infos;
    }

    /** 将单条指标实体转为展示信息，保留层级、目标值、状态、样本量与备注。 */
    private EvaluationMetricInfo toMetricInfo(EvalResultEntity row) {
        EvaluationMetricInfo info = new EvaluationMetricInfo();
        info.setMetricCode(row.getMetricCode());
        info.setMetricName(row.getMetricName());
        info.setMetricLayer(row.getMetricLayer());
        info.setStageCode(row.getStageCode());
        info.setValue(row.getMetricValue());
        info.setUnit(row.getUnit());
        info.setTargetValue(row.getTargetValue());
        info.setStatus(row.getStatus());
        info.setSampleSize(row.getSampleSize());
        info.setAttribution(row.getAttribution());
        info.setNote(row.getNote());
        return info;
    }

    /** 将运行实体转为运行详情，标记结果是否可用以及检索是否被截断。 */
    private RunDetailInfo toRunDetail(EvalRunEntity run) {
        RunDetailInfo info = new RunDetailInfo();
        info.setRunId(run.getRunId());
        info.setKbId(run.getKbId());
        info.setStatus(run.getStatus());
        info.setResultUsable(isUsable(run));
        info.setUnusableReason(run.getUnusableReason());
        info.setDatasetVersionNo(run.getDatasetVersionNo());
        info.setSnapshotId(run.getSnapshotId());
        info.setConfigVersion(run.getConfigVersion());
        info.setTaskConfigVersion(run.getTaskConfigVersion());
        info.setJudgeMode(run.getJudgeMode());
        info.setJudgeVersion(run.getJudgeVersion());
        info.setIndexGeneration(run.getIndexGeneration());
        info.setScopeType(run.getScopeType());
        info.setStageCode(run.getStageCode());
        info.setCaseTotal(run.getCaseTotal());
        info.setCaseDone(run.getCaseDone());
        info.setRetrievalTruncated(run.getRetrievalTruncated() != null
                && run.getRetrievalTruncated() == 1);
        info.setStartedAt(run.getStartedAt());
        info.setFinishedAt(run.getFinishedAt());
        info.setDurationMs(run.getDurationMs());
        return info;
    }

    /** 将运行实体转为概览用摘要，附带核心指标通过数（共 6 项）。 */
    RunBriefInfo toRunBrief(EvalRunEntity run, List<EvalResultEntity> rows) {
        RunBriefInfo info = new RunBriefInfo();
        info.setRunId(run.getRunId());
        info.setStatus(run.getStatus());
        info.setResultUsable(isUsable(run));
        info.setFinishedAt(run.getFinishedAt());
        info.setDurationMs(run.getDurationMs());
        info.setCoreTotal(6);
        info.setCorePassCount(countCorePass(rows));
        return info;
    }

    /** 将运行实体转为创建运行的返回摘要，reused 表示命中了 2 小时内可复用的同指纹运行。 */
    RunSummaryInfo toRunSummary(EvalRunEntity run, boolean reused) {
        RunSummaryInfo info = new RunSummaryInfo();
        info.setRunId(run.getRunId());
        info.setStatus(run.getStatus());
        info.setResultUsable(isUsable(run));
        info.setUnusableReason(run.getUnusableReason());
        info.setDatasetVersionNo(run.getDatasetVersionNo());
        info.setSnapshotId(run.getSnapshotId());
        info.setConfigVersion(run.getConfigVersion());
        info.setJudgeVersion(run.getJudgeVersion());
        info.setIndexGeneration(run.getIndexGeneration());
        info.setCaseTotal(run.getCaseTotal());
        info.setCaseDone(run.getCaseDone());
        info.setFinishedAt(run.getFinishedAt());
        info.setDurationMs(run.getDurationMs());
        info.setReused(reused);
        return info;
    }

    /** 统计核心层指标中状态为通过的数量。 */
    int countCorePass(List<EvalResultEntity> rows) {
        int count = 0;
        for (EvalResultEntity row : rows) {
            if (EvalMetricLayer.CORE.name().equals(row.getMetricLayer())
                    && EvalMetricStatus.PASS.name().equals(row.getStatus())) {
                count++;
            }
        }
        return count;
    }

    /** 收集状态为未接入的指标提示标签，去重后返回供前端展示能力缺口。 */
    List<String> notConnectedCodes(List<EvalResultEntity> rows) {
        List<String> labels = new ArrayList<>();
        for (EvalResultEntity row : rows) {
            if (!EvalMetricStatus.NOT_CONNECTED.name().equals(row.getStatus())) {
                continue;
            }
            String label = NOT_CONNECTED_LABELS.get(row.getMetricCode());
            if (label != null && !labels.contains(label)) {
                labels.add(label);
            }
        }
        return labels;
    }

    /** 按运行 ID 查询运行记录。 */
    EvalRunEntity selectRunByRunId(String tenantCode, String runId) {
        return runMapper.selectOne(new QueryWrapper<EvalRunEntity>()
                .eq("tenant_code", tenantCode)
                .eq("run_id", runId)
                .eq("is_deleted", 0));
    }

    /** 查询运行下的全部指标行，按指标编码稳定排序。 */
    List<EvalResultEntity> resultsOfRun(String tenantCode, String runId) {
        return resultMapper.selectList(new QueryWrapper<EvalResultEntity>()
                .eq("tenant_code", tenantCode)
                .eq("run_id", runId)
                .eq("is_deleted", 0)
                .orderByAsc("metric_code"));
    }

    /** 查询运行下的全部逐题结果，按写入顺序稳定排序。 */
    List<EvalCaseResultEntity> caseResultsOfRun(String tenantCode, String runId) {
        return caseResultMapper.selectList(new QueryWrapper<EvalCaseResultEntity>()
                .eq("tenant_code", tenantCode)
                .eq("run_id", runId)
                .eq("is_deleted", 0)
                .orderByAsc("create_time")
                .orderByAsc("id"));
    }

    /** 按运行 ID 加载运行，入参为空或不存在时抛出参数或未找到异常。 */
    private EvalRunEntity requireRun(String tenantCode, String runId) {
        String key = requireText(runId, EvaluationStatusCode.EVAL_PARAM_INVALID);
        EvalRunEntity run = selectRunByRunId(tenantCode, key);
        if (run == null) {
            throw error(EvaluationStatusCode.EVAL_RUN_NOT_FOUND);
        }
        return run;
    }
}
