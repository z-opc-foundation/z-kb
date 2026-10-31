package com.zifang.z.kb.resource.evaluation;

import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.resource.evaluation.EvaluationCaseScorer.ScoredChunk;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseEntity;

import java.util.List;
import java.util.Map;

/**
 * 单条用例的评测结果：命中、引用、逐题指标、阶段追踪与期望行为标记。
 */
final class CaseOutcome {

    EvalCaseEntity evalCase;

    String question;

    String answer;

    String answerMode;

    List<ScoredChunk> hits;

    List<ScoredChunk> citations;

    Map<String, Object> caseMetrics;

    Map<String, String> stageTrace;

    long latencyMs;

    String errorMessage;

    boolean expectedRefuse;

    boolean hasExpectedEvidence;

    boolean evidenceHit;

    int evidenceRank;

    double answerAccuracy;

    double faithfulness;

    double citationPrecision;

    double citationCoverage;

    boolean falseRefusal;

    double ndcg;

    /** 判断阶段追踪中该阶段是否为失败。 */
    boolean failedAt(EvaluationStage stage) {
        return stage != null && "FAIL".equals(stageTrace.get(stage.name()));
    }
}
