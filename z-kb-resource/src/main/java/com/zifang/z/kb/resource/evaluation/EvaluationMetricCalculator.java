package com.zifang.z.kb.resource.evaluation;

import com.zifang.z.kb.api.evaluation.EvalMetricLayer;
import com.zifang.z.kb.api.evaluation.EvalMetricStatus;
import com.zifang.z.kb.api.evaluation.EvalScopeType;
import com.zifang.z.kb.api.evaluation.EvaluationMetricCode;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalResultEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalRunEntity;
import com.zifang.z.kb.storage.evaluation.mapper.EvalResultMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.INDEX_COVERAGE_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.MAX_STATS_CHUNKS;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.NOTE_LOCAL;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.NOTE_NOT_CONNECTED;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.NOTE_RUNTIME;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.OVERLONG_CHARS;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.PARSE_SUCCESS_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.RECALL_FLOOR_TARGET;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.chunkLength;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.decimal;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.isIndexed;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.percentile;

/**
 * 四层指标计算与落库：核心、前置、诊断、运行时指标的目标、状态与备注。
 */
final class EvaluationMetricCalculator {

    private final LocalHashEmbedding embedding;

    private final EvalResultMapper evalResultMapper;

    EvaluationMetricCalculator(LocalHashEmbedding embedding, EvalResultMapper evalResultMapper) {
        this.embedding = embedding;
        this.evalResultMapper = evalResultMapper;
    }

    private static final List<MetricSpec> METRICS = Collections.unmodifiableList(Arrays.asList(
            spec(EvaluationMetricCode.ANSWER_ACCURACY, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.80d, false, false),
            spec(EvaluationMetricCode.FAITHFULNESS, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.85d, false, false),
            spec(EvaluationMetricCode.CITATION_PRECISION, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.85d, false, false),
            spec(EvaluationMetricCode.REFUSAL_ACCURACY, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.90d, false, false),
            spec(EvaluationMetricCode.CITATION_COVERAGE, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.90d, false, false),
            spec(EvaluationMetricCode.FALSE_REFUSAL_RATE, EvalMetricLayer.CORE, EvaluationStage.CORE,
                    "ratio", 0.05d, true, false),
            spec(EvaluationMetricCode.PARSE_SUCCESS_RATE, EvalMetricLayer.PRECONDITION,
                    EvaluationStage.S1, "ratio", PARSE_SUCCESS_TARGET, false, false),
            spec(EvaluationMetricCode.INDEX_COVERAGE, EvalMetricLayer.PRECONDITION,
                    EvaluationStage.S4, "ratio", INDEX_COVERAGE_TARGET, false, false),
            spec(EvaluationMetricCode.RECALL_AT_10_FLOOR, EvalMetricLayer.PRECONDITION,
                    EvaluationStage.S5, "ratio", RECALL_FLOOR_TARGET, false, false),
            spec(EvaluationMetricCode.PARSE_FAILED_COUNT, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S1, "count", 0.0d, true, false),
            spec(EvaluationMetricCode.AVG_CHUNK_LENGTH, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S2, "chars", null, false, false),
            spec(EvaluationMetricCode.OVERLONG_CHUNK_RATIO, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S2, "ratio", 0.10d, true, false),
            spec(EvaluationMetricCode.BOUNDARY_F1, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S2, "ratio", 0.80d, false, false),
            spec(EvaluationMetricCode.HEADING_COVERAGE, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S2, "ratio", 0.80d, false, false),
            spec(EvaluationMetricCode.CONTEXT_FAITHFULNESS, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S3, "ratio", 0.80d, false, true),
            spec(EvaluationMetricCode.INDEX_COVERAGE_RATIO, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S4, "ratio", INDEX_COVERAGE_TARGET, false, false),
            spec(EvaluationMetricCode.EMPTY_VECTOR_COUNT, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S4, "count", 0.0d, true, false),
            spec(EvaluationMetricCode.RECALL_AT_10, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S5, "ratio", RECALL_FLOOR_TARGET, false, false),
            spec(EvaluationMetricCode.NDCG_AT_10, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S5, "ratio", RECALL_FLOOR_TARGET, false, false),
            spec(EvaluationMetricCode.TOP1_HIT_RATE, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S5, "ratio", RECALL_FLOOR_TARGET, false, false),
            spec(EvaluationMetricCode.MRR, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S5, "ratio", RECALL_FLOOR_TARGET, false, false),
            spec(EvaluationMetricCode.RERANK_EFFECT, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S6, "ratio", null, false, true),
            spec(EvaluationMetricCode.S7_CITATION_PRECISION, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S7, "ratio", 0.85d, false, false),
            spec(EvaluationMetricCode.S7_CITATION_COVERAGE, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S7, "ratio", 0.90d, false, false),
            spec(EvaluationMetricCode.S7_ANSWER_SUPPORT_RATE, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S7, "ratio", 0.85d, false, false),
            spec(EvaluationMetricCode.FEEDBACK_REGRESSION, EvalMetricLayer.DIAGNOSTIC,
                    EvaluationStage.S8, "ratio", 0.90d, false, true),
            spec(EvaluationMetricCode.P95_LATENCY_MS, EvalMetricLayer.RUNTIME,
                    EvaluationStage.RUNTIME, "ms", 3000.0d, true, false),
            spec(EvaluationMetricCode.ERROR_RATE, EvalMetricLayer.RUNTIME,
                    EvaluationStage.RUNTIME, "ratio", 0.02d, true, false),
            spec(EvaluationMetricCode.COST_PER_RUN, EvalMetricLayer.RUNTIME,
                    EvaluationStage.RUNTIME, "cost", null, true, true),
            spec(EvaluationMetricCode.BACKLOG_TASKS, EvalMetricLayer.RUNTIME,
                    EvaluationStage.RUNTIME, "count", 0.0d, true, true)));

    /** 汇总全部用例结果，计算核心、前置、诊断与运行时四层指标值及各自样本量。 */
    MetricComputation computeMetrics(List<CaseOutcome> outcomes,
            List<RetrievalChunkEntity> statsChunks, long totalChunks, double indexCoverage,
            long indexedChunks, boolean truncated) {
        MetricComputation computation = new MetricComputation();
        computation.values = new HashMap<>();
        computation.samples = new HashMap<>();
        computation.applicable = new HashSet<>();
        int total = outcomes.size();
        long latencyMax = 0L;
        int answerCases = 0;
        int refuseCases = 0;
        int evidenceCases = 0;
        int falseRefusals = 0;
        int parseFailed = 0;
        int parsePassed = 0;
        double answerSum = 0.0d;
        double faithfulnessSum = 0.0d;
        double citationPrecisionSum = 0.0d;
        double citationCoverageSum = 0.0d;
        double refusalSum = 0.0d;
        double recallSum = 0.0d;
        double ndcgSum = 0.0d;
        double top1Sum = 0.0d;
        double mrrSum = 0.0d;
        double boundarySum = 0.0d;
        int boundaryCount = 0;
        List<Long> latencies = new ArrayList<>();
        int errors = 0;
        for (CaseOutcome outcome : outcomes) {
            answerSum += outcome.answerAccuracy;
            faithfulnessSum += outcome.faithfulness;
            if (outcome.expectedRefuse) {
                refuseCases++;
                refusalSum += outcome.answerAccuracy;
            } else {
                answerCases++;
                citationPrecisionSum += Math.max(0.0d, outcome.citationPrecision);
                citationCoverageSum += Math.max(0.0d, outcome.citationCoverage);
                if (outcome.falseRefusal) {
                    falseRefusals++;
                }
            }
            if (hasText(outcome.errorMessage)) {
                errors++;
            }
            if (outcome.hasExpectedEvidence) {
                evidenceCases++;
                recallSum += outcome.evidenceHit ? 1.0d : 0.0d;
                ndcgSum += outcome.ndcg;
                top1Sum += outcome.evidenceRank == 1 ? 1.0d : 0.0d;
                mrrSum += outcome.evidenceRank > 0 ? 1.0d / outcome.evidenceRank : 0.0d;
            }
            if (EvalMetricStatus.FAIL.name().equals(
                    outcome.stageTrace.get(EvaluationStage.S1.name()))) {
                parseFailed++;
            } else if (EvalMetricStatus.PASS.name().equals(
                    outcome.stageTrace.get(EvaluationStage.S1.name()))) {
                parsePassed++;
            }
            if (outcome.hasExpectedEvidence) {
                boundarySum += EvalMetricStatus.PASS.name().equals(
                        outcome.stageTrace.get(EvaluationStage.S2.name())) ? 1.0d : 0.0d;
                boundaryCount++;
            }
            latencies.add(outcome.latencyMs);
            latencyMax = Math.max(latencyMax, outcome.latencyMs);
        }
        double parseSuccess = total == 0 ? 0.0d : (double) parsePassed / (double) total;
        Double recallFloor = evidenceCases == 0 ? null : recallSum / (double) evidenceCases;
        double avgChunkLength = 0.0d;
        double overlong = 0.0d;
        double headingCoverage = 0.0d;
        int emptyVector = 0;
        int adjustedStats = Math.min(statsChunks.size(), MAX_STATS_CHUNKS);
        long lengthSum = 0L;
        int overlongCount = 0;
        int headingCount = 0;
        for (int i = 0; i < adjustedStats; i++) {
            RetrievalChunkEntity chunk = statsChunks.get(i);
            int length = chunkLength(chunk);
            lengthSum += length;
            if (length > OVERLONG_CHARS) {
                overlongCount++;
            }
            if (hasText(chunk.getHeading())) {
                headingCount++;
            }
            if (isIndexed(chunk)
                    && (!hasText(chunk.getEmbedding())
                    || embedding.decode(chunk.getEmbedding()) == null)) {
                emptyVector++;
            }
        }
        if (adjustedStats > 0) {
            avgChunkLength = (double) lengthSum / (double) adjustedStats;
            overlong = (double) overlongCount / (double) adjustedStats;
            headingCoverage = (double) headingCount / (double) adjustedStats;
        }
        double boundaryF1 = boundaryCount == 0 ? 0.0d : boundarySum / (double) boundaryCount;
        put(computation, EvaluationMetricCode.ANSWER_ACCURACY,
                total == 0 ? null : answerSum / (double) total, total, true);
        put(computation, EvaluationMetricCode.FAITHFULNESS,
                total == 0 ? null : faithfulnessSum / (double) total, total, true);
        put(computation, EvaluationMetricCode.CITATION_PRECISION,
                answerCases == 0 ? null : citationPrecisionSum / (double) answerCases, answerCases,
                answerCases > 0);
        put(computation, EvaluationMetricCode.REFUSAL_ACCURACY,
                refuseCases == 0 ? null : refusalSum / (double) refuseCases, refuseCases,
                refuseCases > 0);
        put(computation, EvaluationMetricCode.CITATION_COVERAGE,
                answerCases == 0 ? null : citationCoverageSum / (double) answerCases, answerCases,
                answerCases > 0);
        put(computation, EvaluationMetricCode.FALSE_REFUSAL_RATE,
                answerCases == 0 ? null : (double) falseRefusals / (double) answerCases,
                answerCases, answerCases > 0);
        put(computation, EvaluationMetricCode.PARSE_SUCCESS_RATE,
                total == 0 ? null : parseSuccess, total, total > 0);
        put(computation, EvaluationMetricCode.INDEX_COVERAGE,
                totalChunks == 0L ? 0.0d : indexCoverage, (int) Math.min(totalChunks,
                        Integer.MAX_VALUE), true);
        put(computation, EvaluationMetricCode.RECALL_AT_10_FLOOR, recallFloor, evidenceCases,
                evidenceCases > 0);
        put(computation, EvaluationMetricCode.PARSE_FAILED_COUNT, (double) parseFailed, total,
                true);
        put(computation, EvaluationMetricCode.AVG_CHUNK_LENGTH,
                adjustedStats == 0 ? null : avgChunkLength, adjustedStats, adjustedStats > 0);
        put(computation, EvaluationMetricCode.OVERLONG_CHUNK_RATIO,
                adjustedStats == 0 ? null : overlong, adjustedStats, adjustedStats > 0);
        put(computation, EvaluationMetricCode.BOUNDARY_F1, boundaryCount == 0 ? null : boundaryF1,
                boundaryCount, boundaryCount > 0);
        put(computation, EvaluationMetricCode.HEADING_COVERAGE,
                adjustedStats == 0 ? null : headingCoverage, adjustedStats, adjustedStats > 0);
        put(computation, EvaluationMetricCode.CONTEXT_FAITHFULNESS, null, 0, false);
        put(computation, EvaluationMetricCode.INDEX_COVERAGE_RATIO,
                totalChunks == 0L ? 0.0d : indexCoverage, (int) Math.min(totalChunks,
                        Integer.MAX_VALUE), true);
        put(computation, EvaluationMetricCode.EMPTY_VECTOR_COUNT, (double) emptyVector,
                adjustedStats, true);
        put(computation, EvaluationMetricCode.RECALL_AT_10,
                evidenceCases == 0 ? null : recallSum / (double) evidenceCases, evidenceCases,
                evidenceCases > 0);
        put(computation, EvaluationMetricCode.NDCG_AT_10,
                evidenceCases == 0 ? null : ndcgSum / (double) evidenceCases, evidenceCases,
                evidenceCases > 0);
        put(computation, EvaluationMetricCode.TOP1_HIT_RATE,
                evidenceCases == 0 ? null : top1Sum / (double) evidenceCases, evidenceCases,
                evidenceCases > 0);
        put(computation, EvaluationMetricCode.MRR,
                evidenceCases == 0 ? null : mrrSum / (double) evidenceCases, evidenceCases,
                evidenceCases > 0);
        put(computation, EvaluationMetricCode.RERANK_EFFECT, null, 0, false);
        put(computation, EvaluationMetricCode.S7_CITATION_PRECISION,
                answerCases == 0 ? null : citationPrecisionSum / (double) answerCases, answerCases,
                answerCases > 0);
        put(computation, EvaluationMetricCode.S7_CITATION_COVERAGE,
                answerCases == 0 ? null : citationCoverageSum / (double) answerCases, answerCases,
                answerCases > 0);
        put(computation, EvaluationMetricCode.S7_ANSWER_SUPPORT_RATE,
                total == 0 ? null : faithfulnessSum / (double) total, total, total > 0);
        put(computation, EvaluationMetricCode.FEEDBACK_REGRESSION, null, 0, false);
        put(computation, EvaluationMetricCode.P95_LATENCY_MS,
                total == 0 ? null : percentile(latencies, 0.95d), total, total > 0);
        put(computation, EvaluationMetricCode.ERROR_RATE,
                total == 0 ? null : (double) errors / (double) total, total, total > 0);
        put(computation, EvaluationMetricCode.COST_PER_RUN, null, 0, false);
        put(computation, EvaluationMetricCode.BACKLOG_TASKS, null, 0, false);
        computation.parseSuccessRate = parseSuccess;
        computation.recallFloor = recallFloor;
        computation.indexCoverage = indexCoverage;
        computation.totalChunks = totalChunks;
        computation.indexedChunks = indexedChunks;
        computation.truncated = truncated;
        computation.latencyMax = latencyMax;
        return computation;
    }

    /** 按指标规格逐条落库指标值、目标、状态与备注，阶段级运行仅写入该阶段指标。 */
    void persistMetrics(String tenantCode, EvalRunEntity run, MetricComputation computation,
            EvalScopeType scope, EvaluationStage stage, String actorId) {
        Instant now = Instant.now();
        for (MetricSpec spec : METRICS) {
            if (scope == EvalScopeType.STAGE && (stage == null
                    || !stage.name().equals(spec.stage))) {
                continue;
            }
            Double raw = computation.values.get(spec.code);
            boolean applicable = computation.applicable.contains(spec.code);
            int sample = computation.samples.containsKey(spec.code)
                    ? computation.samples.get(spec.code) : 0;
            EvalResultEntity row = new EvalResultEntity();
            row.setId(UUID.randomUUID().toString());
            row.setRunId(run.getRunId());
            row.setTenantCode(tenantCode);
            row.setMetricCode(spec.code);
            row.setMetricName(metricName(spec.code));
            row.setMetricLayer(spec.layer.name());
            row.setStageCode(spec.stage);
            row.setMetricValue(raw == null ? null : decimal(raw));
            row.setUnit(spec.unit);
            row.setTargetValue(spec.target);
            row.setStatus(metricStatus(spec, raw, sample, applicable));
            row.setSampleSize(sample);
            row.setAttribution(spec.stage);
            row.setNote(metricNote(spec));
            row.setIsDeleted(0);
            row.setCreateBy(actorId);
            row.setUpdateBy(actorId);
            row.setCreateTime(now);
            row.setUpdateTime(now);
            evalResultMapper.insert(row);
        }
    }

    /** 判定指标状态：未接入、不适用或运行时部分可用，其余按目标值方向比较得出通过或失败。 */
    private String metricStatus(MetricSpec spec, Double value, int sample, boolean applicable) {
        if (spec.notConnected) {
            return EvalMetricStatus.NOT_CONNECTED.name();
        }
        if (!applicable || value == null || sample <= 0) {
            return EvalMetricStatus.NOT_APPLICABLE.name();
        }
        if (EvaluationStage.RUNTIME.name().equals(spec.stage)) {
            return EvalMetricStatus.PARTIAL.name();
        }
        if (spec.target == null) {
            return EvalMetricStatus.NOT_APPLICABLE.name();
        }
        double target = spec.target.doubleValue();
        boolean pass = spec.lower ? value <= target + 1.0e-9 : value + 1.0e-9 >= target;
        return pass ? EvalMetricStatus.PASS.name() : EvalMetricStatus.FAIL.name();
    }

    /** 返回指标备注，说明未接入、运行时未接入或本地代理未校准的口径。 */
    private String metricNote(MetricSpec spec) {
        if (spec.notConnected) {
            return NOTE_NOT_CONNECTED;
        }
        if (EvaluationStage.RUNTIME.name().equals(spec.stage)) {
            return NOTE_RUNTIME;
        }
        return NOTE_LOCAL;
    }

    /** 构建指标规格，记录层级、所属阶段、单位、目标值、方向及是否未接入。 */
    private static MetricSpec spec(String code, EvalMetricLayer layer, EvaluationStage stage,
            String unit, Double target, boolean lower, boolean notConnected) {
        MetricSpec spec = new MetricSpec();
        spec.code = code;
        spec.layer = layer;
        spec.stage = stage.name();
        spec.unit = unit;
        spec.target = target == null ? null : BigDecimal.valueOf(target)
                .setScale(6, RoundingMode.HALF_UP);
        spec.lower = lower;
        spec.notConnected = notConnected;
        return spec;
    }

    /** 返回指标编码对应的中文名称，未知编码原样返回。 */
    private static String metricName(String code) {
        switch (code) {
            case EvaluationMetricCode.ANSWER_ACCURACY:
                return "回答准确率";
            case EvaluationMetricCode.FAITHFULNESS:
                return "忠实度";
            case EvaluationMetricCode.CITATION_PRECISION:
                return "引用精确率";
            case EvaluationMetricCode.REFUSAL_ACCURACY:
                return "拒答准确率";
            case EvaluationMetricCode.CITATION_COVERAGE:
                return "引用覆盖率";
            case EvaluationMetricCode.FALSE_REFUSAL_RATE:
                return "误拒率";
            case EvaluationMetricCode.PARSE_SUCCESS_RATE:
                return "解析成功率";
            case EvaluationMetricCode.INDEX_COVERAGE:
                return "索引覆盖率";
            case EvaluationMetricCode.RECALL_AT_10_FLOOR:
                return "Recall@10 下限";
            case EvaluationMetricCode.PARSE_FAILED_COUNT:
                return "解析失败数";
            case EvaluationMetricCode.AVG_CHUNK_LENGTH:
                return "平均块长";
            case EvaluationMetricCode.OVERLONG_CHUNK_RATIO:
                return "超长块占比";
            case EvaluationMetricCode.BOUNDARY_F1:
                return "边界 F1";
            case EvaluationMetricCode.HEADING_COVERAGE:
                return "标题覆盖率";
            case EvaluationMetricCode.CONTEXT_FAITHFULNESS:
                return "上下文忠实度";
            case EvaluationMetricCode.INDEX_COVERAGE_RATIO:
                return "索引覆盖率（诊断）";
            case EvaluationMetricCode.EMPTY_VECTOR_COUNT:
                return "空向量数";
            case EvaluationMetricCode.RECALL_AT_10:
                return "Recall@10";
            case EvaluationMetricCode.NDCG_AT_10:
                return "nDCG@10";
            case EvaluationMetricCode.TOP1_HIT_RATE:
                return "Top1 命中率";
            case EvaluationMetricCode.MRR:
                return "MRR";
            case EvaluationMetricCode.RERANK_EFFECT:
                return "精排增益";
            case EvaluationMetricCode.S7_CITATION_PRECISION:
                return "生成引用精确率";
            case EvaluationMetricCode.S7_CITATION_COVERAGE:
                return "生成引用覆盖率";
            case EvaluationMetricCode.S7_ANSWER_SUPPORT_RATE:
                return "答案支撑率";
            case EvaluationMetricCode.FEEDBACK_REGRESSION:
                return "反馈回归";
            case EvaluationMetricCode.P95_LATENCY_MS:
                return "P95 延迟";
            case EvaluationMetricCode.ERROR_RATE:
                return "错误率";
            case EvaluationMetricCode.COST_PER_RUN:
                return "单次成本";
            case EvaluationMetricCode.BACKLOG_TASKS:
                return "积压任务";
            default:
                return code;
        }
    }

    /** 记录指标值、样本量及该指标是否适用。 */
    private static void put(MetricComputation computation, String code, Double value, int sample,
            boolean applicable) {
        computation.values.put(code, value);
        computation.samples.put(code, sample);
        if (applicable) {
            computation.applicable.add(code);
        }
    }

    private static final class MetricSpec {

        private String code;

        private EvalMetricLayer layer;

        private String stage;

        private String unit;

        private BigDecimal target;

        private boolean lower;

        private boolean notConnected;
    }

    static final class MetricComputation {

        Map<String, Double> values;

        Map<String, Integer> samples;

        Set<String> applicable;

        double parseSuccessRate;

        Double recallFloor;

        double indexCoverage;

        long totalChunks;

        long indexedChunks;

        boolean truncated;

        long latencyMax;
    }
}
