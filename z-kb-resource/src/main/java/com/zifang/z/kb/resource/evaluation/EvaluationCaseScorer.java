package com.zifang.z.kb.resource.evaluation;

import com.zifang.z.kb.api.evaluation.EvalAnswerMode;
import com.zifang.z.kb.api.evaluation.EvalExpectedBehavior;
import com.zifang.z.kb.api.evaluation.EvalMetricStatus;
import com.zifang.z.kb.api.evaluation.EvaluationMetricCode;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseEntity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.ANSWER_CHUNK_CHARS;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.ANSWER_TOTAL_CHARS;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.clamp01;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.isIndexed;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.messageOf;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parsePlain;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.round;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.runnableStages;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.text;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.truncate;

/**
 * 单条用例的确定性判定：向量检索、抽取式作答、引用与 S1–S8 阶段追踪。
 */
final class EvaluationCaseScorer {

    private final LocalHashEmbedding embedding;

    EvaluationCaseScorer(LocalHashEmbedding embedding) {
        this.embedding = embedding;
    }

    /** 对单条用例做确定性检索与抽取式作答，产出命中、引用、核心指标与 S1–S8 阶段追踪。 */
    CaseOutcome evaluateCase(EvalCaseEntity evalCase, List<ChunkCandidate> candidates,
            List<RetrievalChunkEntity> statsChunks, Set<String> snapshotMaterialIds,
            Set<String> snapshotVersionIds, JudgeSettings judge) {
        long started = System.nanoTime();
        CaseOutcome outcome = new CaseOutcome();
        outcome.evalCase = evalCase;
        outcome.question = evalCase.getQuestion();
        outcome.stageTrace = new LinkedHashMap<>();
        outcome.caseMetrics = new LinkedHashMap<>();
        outcome.hits = new ArrayList<>();
        outcome.citations = new ArrayList<>();
        EvidenceSpec evidence = parseEvidence(evalCase.getExpectedEvidence());
        outcome.expectedRefuse = EvalExpectedBehavior.REFUSE.name()
                .equals(evalCase.getExpectedBehavior());
        if (outcome.expectedRefuse) {
            // 拒答题的证据只描述越界主题，不参与 S1–S5 证据判定。
            evidence = new EvidenceSpec();
        }
        outcome.hasExpectedEvidence = !evidence.isEmpty();
        try {
            double[] queryVector = embedding.embed(evalCase.getQuestion());
            List<ScoredChunk> scored = new ArrayList<>();
            for (ChunkCandidate candidate : candidates) {
                double score = Math.max(0.0d, embedding.cosine(queryVector, candidate.vector));
                if (score + 1.0e-9 < judge.minScore) {
                    continue;
                }
                ScoredChunk hit = new ScoredChunk();
                hit.chunk = candidate.chunk;
                hit.score = score;
                scored.add(hit);
            }
            scored.sort(Comparator.comparingDouble((ScoredChunk item) -> item.score).reversed()
                    .thenComparing(item -> text(item.chunk.getChunkId()))
                    .thenComparing(item -> item.chunk.getOrdinal() == null
                            ? 0 : item.chunk.getOrdinal()));
            for (int i = 0; i < scored.size() && i < judge.topK; i++) {
                ScoredChunk hit = scored.get(i);
                hit.rank = i + 1;
                outcome.hits.add(hit);
            }
            outcome.answerMode = outcome.hits.isEmpty() ? EvalAnswerMode.REFUSED.name()
                    : EvalAnswerMode.EXTRACTIVE_TOP3.name();
            outcome.answer = outcome.hits.isEmpty() ? "" : buildAnswer(outcome.hits);
            for (int i = 0; i < outcome.hits.size() && i < 3; i++) {
                outcome.citations.add(outcome.hits.get(i));
            }
            outcome.latencyMs = Math.max(0L, (System.nanoTime() - started) / 1_000_000L);
            int expectedMaterialChunks = 0;
            int expectedIndexedChunks = 0;
            for (RetrievalChunkEntity chunk : statsChunks) {
                if (matchesEvidence(evidence, chunk)) {
                    expectedMaterialChunks++;
                    if (isIndexed(chunk)) {
                        expectedIndexedChunks++;
                    }
                }
            }
            for (ScoredChunk hit : outcome.hits) {
                if (matchesEvidence(evidence, hit.chunk)) {
                    outcome.evidenceHit = true;
                    outcome.evidenceRank = hit.rank;
                    break;
                }
            }
            if (!outcome.hasExpectedEvidence && !outcome.expectedRefuse) {
                outcome.evidenceHit = !outcome.hits.isEmpty();
                outcome.evidenceRank = outcome.hits.isEmpty() ? 0 : 1;
            }
            outcome.ndcg = outcome.evidenceRank > 0
                    ? 1.0d / (Math.log(outcome.evidenceRank + 1) / Math.log(2.0d)) : 0.0d;
            String citationText = citationText(outcome.citations);
            if (outcome.expectedRefuse) {
                outcome.answerAccuracy = EvalAnswerMode.REFUSED.name().equals(outcome.answerMode)
                        ? 1.0d : 0.0d;
                outcome.faithfulness = outcome.answerAccuracy;
                outcome.citationPrecision = -1.0d;
                outcome.citationCoverage = -1.0d;
            } else {
                double expectedRecall = termRecall(evalCase.getExpectedAnswer(), outcome.answer);
                boolean answerSupported = expectedRecall >= 0.5d;
                if (!hasText(evalCase.getExpectedAnswer())) {
                    answerSupported = outcome.evidenceHit;
                }
                outcome.answerAccuracy = answerSupported ? 1.0d : 0.0d;
                outcome.faithfulness = EvalAnswerMode.REFUSED.name().equals(outcome.answerMode)
                        ? 0.0d : supportRatio(outcome.answer, citationText);
                outcome.citationPrecision = citationPrecision(outcome, evidence, citationText);
                outcome.citationCoverage = citationCoverage(outcome, evidence);
                outcome.falseRefusal = EvalAnswerMode.REFUSED.name().equals(outcome.answerMode);
            }
            outcome.stageTrace.put(EvaluationStage.S1.name(),
                    stageParse(evidence, snapshotMaterialIds, snapshotVersionIds));
            outcome.stageTrace.put(EvaluationStage.S2.name(),
                    stageChunk(outcome.hasExpectedEvidence, expectedMaterialChunks,
                            statsChunks.size()));
            outcome.stageTrace.put(EvaluationStage.S3.name(), EvalMetricStatus.NOT_CONNECTED.name());
            outcome.stageTrace.put(EvaluationStage.S4.name(),
                    stageIndex(outcome.hasExpectedEvidence, expectedMaterialChunks,
                            expectedIndexedChunks, statsChunks));
            outcome.stageTrace.put(EvaluationStage.S5.name(),
                    stageRecall(outcome, outcome.hits.isEmpty()));
            outcome.stageTrace.put(EvaluationStage.S6.name(), EvalMetricStatus.NOT_CONNECTED.name());
            outcome.stageTrace.put(EvaluationStage.S7.name(),
                    stageGeneration(outcome, citationText));
            outcome.stageTrace.put(EvaluationStage.S8.name(), EvalMetricStatus.NOT_CONNECTED.name());
            outcome.caseMetrics.put(EvaluationMetricCode.ANSWER_ACCURACY,
                    round(outcome.answerAccuracy));
            outcome.caseMetrics.put(EvaluationMetricCode.FAITHFULNESS,
                    round(outcome.faithfulness));
            if (outcome.expectedRefuse) {
                outcome.caseMetrics.put(EvaluationMetricCode.REFUSAL_ACCURACY,
                        round(outcome.answerAccuracy));
            } else {
                outcome.caseMetrics.put(EvaluationMetricCode.CITATION_PRECISION,
                        round(Math.max(0.0d, outcome.citationPrecision)));
                outcome.caseMetrics.put(EvaluationMetricCode.CITATION_COVERAGE,
                        round(Math.max(0.0d, outcome.citationCoverage)));
                outcome.caseMetrics.put(EvaluationMetricCode.FALSE_REFUSAL_RATE,
                        outcome.falseRefusal ? 1.0d : 0.0d);
            }
        } catch (RuntimeException exception) {
            outcome.errorMessage = truncate(messageOf(exception), 1000);
            outcome.answerMode = EvalAnswerMode.REFUSED.name();
            outcome.answer = "";
            outcome.answerAccuracy = 0.0d;
            outcome.faithfulness = 0.0d;
            outcome.citationPrecision = outcome.expectedRefuse ? -1.0d : 0.0d;
            outcome.citationCoverage = outcome.expectedRefuse ? -1.0d : 0.0d;
            outcome.latencyMs = Math.max(0L, (System.nanoTime() - started) / 1_000_000L);
            for (EvaluationStage each : runnableStages()) {
                outcome.stageTrace.put(each.name(), isNotConnectedStage(each)
                        ? EvalMetricStatus.NOT_CONNECTED.name() : EvalMetricStatus.FAIL.name());
            }
        }
        return outcome;
    }

    /** 判定 S1 解析阶段：期望证据指向的物料或版本须出现在快照中，无期望证据视为通过。 */
    private String stageParse(EvidenceSpec evidence, Set<String> snapshotMaterialIds,
            Set<String> snapshotVersionIds) {
        if (evidence.isEmpty()) {
            return EvalMetricStatus.PASS.name();
        }
        boolean found = false;
        for (String materialId : evidence.materialIds) {
            if (snapshotMaterialIds.contains(materialId)) {
                found = true;
                break;
            }
        }
        if (!found) {
            for (String versionId : evidence.materialVersionIds) {
                if (snapshotVersionIds.contains(versionId)) {
                    found = true;
                    break;
                }
            }
        }
        if (found) {
            return EvalMetricStatus.PASS.name();
        }
        return evidence.materialIds.isEmpty() && evidence.materialVersionIds.isEmpty()
                ? EvalMetricStatus.PASS.name() : EvalMetricStatus.FAIL.name();
    }

    /** 判定 S2 分块阶段：有期望证据时要求命中分块存在，否则要求快照内存在分块。 */
    private String stageChunk(boolean hasExpectedEvidence, int expectedChunks, int totalChunks) {
        if (hasExpectedEvidence) {
            return expectedChunks > 0 ? EvalMetricStatus.PASS.name()
                    : EvalMetricStatus.FAIL.name();
        }
        return totalChunks > 0 ? EvalMetricStatus.PASS.name() : EvalMetricStatus.FAIL.name();
    }

    private boolean isNotConnectedStage(EvaluationStage stage) {
        return EvaluationStage.S3 == stage || EvaluationStage.S6 == stage
                || EvaluationStage.S8 == stage;
    }

    /** 判定 S4 索引阶段：有期望证据时要求对应分块已索引，否则要求存在任一已索引分块。 */
    private String stageIndex(boolean hasExpectedEvidence, int expectedChunks, int expectedIndexed,
            List<RetrievalChunkEntity> statsChunks) {
        if (hasExpectedEvidence) {
            return expectedIndexed > 0 ? EvalMetricStatus.PASS.name()
                    : EvalMetricStatus.FAIL.name();
        }
        for (RetrievalChunkEntity chunk : statsChunks) {
            if (isIndexed(chunk)) {
                return EvalMetricStatus.PASS.name();
            }
        }
        return EvalMetricStatus.FAIL.name();
    }

    /** 判定 S5 召回阶段：拒答题须无命中，有证据题须召回期望分块，其余题按是否有命中判定。 */
    private String stageRecall(CaseOutcome outcome, boolean noHits) {
        if (outcome.expectedRefuse) {
            return noHits ? EvalMetricStatus.PASS.name() : EvalMetricStatus.PARTIAL.name();
        }
        if (outcome.hasExpectedEvidence) {
            return outcome.evidenceRank > 0 ? EvalMetricStatus.PASS.name()
                    : (noHits ? EvalMetricStatus.FAIL.name() : EvalMetricStatus.PARTIAL.name());
        }
        return noHits ? EvalMetricStatus.FAIL.name() : EvalMetricStatus.PASS.name();
    }

    /** 判定 S7 生成阶段：拒答题看是否拒答，作答题看引用对答案的支撑比例是否达到 0.5。 */
    private String stageGeneration(CaseOutcome outcome, String citationText) {
        if (outcome.expectedRefuse) {
            return EvalAnswerMode.REFUSED.name().equals(outcome.answerMode)
                    ? EvalMetricStatus.PASS.name() : EvalMetricStatus.FAIL.name();
        }
        if (EvalAnswerMode.REFUSED.name().equals(outcome.answerMode)) {
            return EvalMetricStatus.FAIL.name();
        }
        if (!outcome.citations.isEmpty()
                && supportRatio(outcome.answer, citationText) + 1.0e-9 >= 0.5d) {
            return EvalMetricStatus.PASS.name();
        }
        return EvalMetricStatus.PARTIAL.name();
    }

    /** 计算引用精确率，即引用分块中命中期望证据（无证据时看是否支撑答案）的占比。 */
    private double citationPrecision(CaseOutcome outcome, EvidenceSpec evidence,
            String citationText) {
        if (outcome.citations.isEmpty()) {
            return 0.0d;
        }
        int relevant = 0;
        for (ScoredChunk citation : outcome.citations) {
            if (matchesEvidence(evidence, citation.chunk)) {
                relevant++;
            } else if (evidence.isEmpty()
                    && supportRatio(outcome.answer, text(citation.chunk.getContent())) > 0.0d) {
                relevant++;
            }
        }
        return clamp01((double) relevant / (double) outcome.citations.size());
    }

    /** 计算引用覆盖率：期望物料或版本被引用覆盖的比例，无任何期望证据约束时返回 1。 */
    private double citationCoverage(CaseOutcome outcome, EvidenceSpec evidence) {
        if (outcome.citations.isEmpty()) {
            return 0.0d;
        }
        if (!evidence.materialIds.isEmpty()) {
            Set<String> cited = new HashSet<>();
            for (ScoredChunk citation : outcome.citations) {
                if (hasText(citation.chunk.getMaterialId())) {
                    cited.add(citation.chunk.getMaterialId());
                }
            }
            int matched = 0;
            for (String expected : evidence.materialIds) {
                if (cited.contains(expected)) {
                    matched++;
                }
            }
            return clamp01((double) matched / (double) evidence.materialIds.size());
        }
        if (!evidence.materialVersionIds.isEmpty()) {
            Set<String> cited = new HashSet<>();
            for (ScoredChunk citation : outcome.citations) {
                if (hasText(citation.chunk.getMaterialVersionId())) {
                    cited.add(citation.chunk.getMaterialVersionId());
                }
            }
            int matched = 0;
            for (String expected : evidence.materialVersionIds) {
                if (cited.contains(expected)) {
                    matched++;
                }
            }
            return clamp01((double) matched / (double) evidence.materialVersionIds.size());
        }
        if (!evidence.keywords.isEmpty()) {
            for (ScoredChunk citation : outcome.citations) {
                if (matchesEvidence(evidence, citation.chunk)) {
                    return 1.0d;
                }
            }
            return 0.0d;
        }
        return 1.0d;
    }

    /** 判断分块是否命中期望证据：物料或版本匹配，或标题与正文包含任一期望关键词。 */
    private boolean matchesEvidence(EvidenceSpec evidence, RetrievalChunkEntity chunk) {
        if (evidence == null || evidence.isEmpty()) {
            return false;
        }
        if (evidenceMatchesMaterial(evidence, chunk)) {
            return true;
        }
        String corpus = (text(chunk.getHeading()) + "\n" + text(chunk.getContent()))
                .toLowerCase(Locale.ROOT);
        for (String keyword : evidence.keywords) {
            if (keyword.length() > 0 && corpus.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    /** 判断分块所属物料或物料版本是否在期望证据清单内。 */
    private boolean evidenceMatchesMaterial(EvidenceSpec evidence, RetrievalChunkEntity chunk) {
        if (evidence == null) {
            return false;
        }
        if (hasText(chunk.getMaterialId())
                && evidence.materialIds.contains(chunk.getMaterialId())) {
            return true;
        }
        return hasText(chunk.getMaterialVersionId())
                && evidence.materialVersionIds.contains(chunk.getMaterialVersionId());
    }

    /** 解析用例期望证据，兼容 JSON 对象、数组与纯文本，统一为物料、版本与关键词集合。 */
    private EvidenceSpec parseEvidence(String raw) {
        EvidenceSpec spec = new EvidenceSpec();
        if (!hasText(raw)) {
            return spec;
        }
        Object node = parsePlain(raw);
        if (node == null) {
            addKeywords(spec, raw);
            return spec;
        }
        if (node instanceof List) {
            for (Object element : (List<?>) node) {
                if (element instanceof String) {
                    addKeyword(spec, (String) element);
                }
            }
            return spec;
        }
        if (node instanceof String) {
            addKeywords(spec, (String) node);
            return spec;
        }
        if (!(node instanceof Map)) {
            return spec;
        }
        Map<?, ?> map = (Map<?, ?>) node;
        Object materialIds = map.get("materialIds");
        if (materialIds instanceof List) {
            for (Object element : (List<?>) materialIds) {
                addMaterialId(spec, stringOf(element));
            }
        }
        Object materialId = map.get("materialId");
        if (materialId instanceof String) {
            addMaterialId(spec, (String) materialId);
        }
        Object versionIds = map.get("materialVersionIds");
        if (versionIds instanceof List) {
            for (Object element : (List<?>) versionIds) {
                addVersionId(spec, stringOf(element));
            }
        }
        Object versionId = map.get("materialVersionId");
        if (versionId instanceof String) {
            addVersionId(spec, (String) versionId);
        }
        Object keywords = map.get("keywords");
        if (keywords instanceof List) {
            for (Object element : (List<?>) keywords) {
                addKeyword(spec, stringOf(element));
            }
        } else if (keywords instanceof String) {
            addKeywords(spec, (String) keywords);
        }
        for (String field : Arrays.asList("keyword", "quote", "text", "evidence")) {
            Object value = map.get(field);
            if (value instanceof String) {
                addKeywords(spec, (String) value);
            }
        }
        return spec;
    }

    private static String stringOf(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    /** 将去空白后的物料 ID 加入期望证据。 */
    private void addMaterialId(EvidenceSpec spec, String value) {
        if (hasText(value)) {
            spec.materialIds.add(value.trim());
        }
    }

    /** 将去空白后的物料版本 ID 加入期望证据。 */
    private void addVersionId(EvidenceSpec spec, String value) {
        if (hasText(value)) {
            spec.materialVersionIds.add(value.trim());
        }
    }

    /** 将去空白后的单个关键词加入期望证据。 */
    private void addKeyword(EvidenceSpec spec, String value) {
        if (hasText(value)) {
            spec.keywords.add(value.trim());
        }
    }

    /** 按中英文逗号、分号及空白切分文本，逐个加入关键词。 */
    private void addKeywords(EvidenceSpec spec, String value) {
        if (!hasText(value)) {
            return;
        }
        for (String part : value.split("[,，;；\\s]+")) {
            addKeyword(spec, part);
        }
    }

    /** 用前三条命中分块拼接抽取式答案，单块截断至 300 字、整段不超过 600 字。 */
    private String buildAnswer(List<ScoredChunk> hits) {
        StringBuilder builder = new StringBuilder();
        int total = 0;
        for (int i = 0; i < hits.size() && i < 3; i++) {
            if (total >= ANSWER_TOTAL_CHARS) {
                break;
            }
            String piece = truncate(hits.get(i).chunk.getContent(), ANSWER_CHUNK_CHARS);
            if (!hasText(piece)) {
                continue;
            }
            if (total > 0) {
                if (total + 1 >= ANSWER_TOTAL_CHARS) {
                    break;
                }
                builder.append('\n');
                total++;
            }
            int remain = ANSWER_TOTAL_CHARS - total;
            String part = truncate(piece, remain);
            builder.append(part);
            total += part.length();
        }
        return builder.toString();
    }

    /** 计算语料对答案的支撑比例，即答案分词后出现在语料中的比例，无分词时退化为整串包含判断。 */
    private double supportRatio(String answer, String corpus) {
        if (!hasText(answer) || !hasText(corpus)) {
            return 0.0d;
        }
        List<String> terms = embedding.queryTerms(answer);
        if (terms.isEmpty()) {
            return corpus.toLowerCase(Locale.ROOT)
                    .contains(answer.toLowerCase(Locale.ROOT)) ? 1.0d : 0.0d;
        }
        String lower = corpus.toLowerCase(Locale.ROOT);
        int matched = 0;
        for (String term : terms) {
            if (lower.contains(term.toLowerCase(Locale.ROOT))) {
                matched++;
            }
        }
        return clamp01((double) matched / (double) terms.size());
    }

    /** 计算期望答案分词在生成答案中的召回比例，用于判定回答是否覆盖要点。 */
    private double termRecall(String expected, String answer) {
        if (!hasText(expected)) {
            return 0.0d;
        }
        if (!hasText(answer)) {
            return 0.0d;
        }
        List<String> terms = embedding.queryTerms(expected);
        if (terms.isEmpty()) {
            return answer.toLowerCase(Locale.ROOT)
                    .contains(expected.toLowerCase(Locale.ROOT)) ? 1.0d : 0.0d;
        }
        String lower = answer.toLowerCase(Locale.ROOT);
        int matched = 0;
        for (String term : terms) {
            if (lower.contains(term.toLowerCase(Locale.ROOT))) {
                matched++;
            }
        }
        return clamp01((double) matched / (double) terms.size());
    }

    /** 将引用分块正文按行拼接为文本，供忠实度与支撑率计算使用。 */
    private String citationText(List<ScoredChunk> citations) {
        StringBuilder builder = new StringBuilder();
        for (ScoredChunk citation : citations) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(text(citation.chunk.getContent()));
        }
        return builder.toString();
    }

    /** 将检索命中转换为可序列化的精简记录列表。 */
    List<Map<String, Object>> retrievedList(List<ScoredChunk> hits) {
        List<Map<String, Object>> records = new ArrayList<>();
        for (ScoredChunk hit : hits) {
            records.add(hitMap(hit));
        }
        return records;
    }

    /** 将引用分块转换为可序列化的精简记录列表。 */
    List<Map<String, Object>> citationList(List<ScoredChunk> hits) {
        List<Map<String, Object>> records = new ArrayList<>();
        for (ScoredChunk hit : hits) {
            records.add(hitMap(hit));
        }
        return records;
    }

    /** 将单个命中分块转为包含排名、分块 ID、来源、标题与分数的映射。 */
    private Map<String, Object> hitMap(ScoredChunk hit) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("rank", hit.rank);
        record.put("chunkId", hit.chunk.getChunkId());
        record.put("materialId", hit.chunk.getMaterialId());
        record.put("materialVersionId", hit.chunk.getMaterialVersionId());
        record.put("artifactId", hit.chunk.getArtifactId());
        record.put("heading", hit.chunk.getHeading());
        record.put("score", round(hit.score));
        record.put("charCount", hit.chunk.getCharCount());
        return record;
    }

    private static final class EvidenceSpec {

        private final Set<String> materialIds = new LinkedHashSet<>();

        private final Set<String> materialVersionIds = new LinkedHashSet<>();

        private final List<String> keywords = new ArrayList<>();

        private boolean isEmpty() {
            return materialIds.isEmpty() && materialVersionIds.isEmpty() && keywords.isEmpty();
        }
    }

    static final class ChunkCandidate {

        RetrievalChunkEntity chunk;

        double[] vector;
    }

    static final class ScoredChunk {

        RetrievalChunkEntity chunk;

        double score;

        int rank;
    }
}
