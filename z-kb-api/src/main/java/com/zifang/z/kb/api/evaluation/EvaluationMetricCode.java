package com.zifang.z.kb.api.evaluation;

/**
 * 评测指标编码。编码固定，前端按编码取口径与对比基线。
 */
public final class EvaluationMetricCode {

    public static final String ANSWER_ACCURACY = "answer_accuracy";
    public static final String FAITHFULNESS = "faithfulness";
    public static final String CITATION_PRECISION = "citation_precision";
    public static final String REFUSAL_ACCURACY = "refusal_accuracy";
    public static final String CITATION_COVERAGE = "citation_coverage";
    public static final String FALSE_REFUSAL_RATE = "false_refusal_rate";

    public static final String PARSE_SUCCESS_RATE = "parse_success_rate";
    public static final String INDEX_COVERAGE = "index_coverage";
    public static final String RECALL_AT_10_FLOOR = "recall_at_10_floor";

    public static final String PARSE_FAILED_COUNT = "parse_failed_count";
    public static final String AVG_CHUNK_LENGTH = "avg_chunk_length";
    public static final String OVERLONG_CHUNK_RATIO = "overlong_chunk_ratio";
    public static final String BOUNDARY_F1 = "boundary_f1";
    public static final String HEADING_COVERAGE = "heading_coverage";
    public static final String CONTEXT_FAITHFULNESS = "context_faithfulness";
    public static final String INDEX_COVERAGE_RATIO = "index_coverage_ratio";
    public static final String EMPTY_VECTOR_COUNT = "empty_vector_count";
    public static final String RECALL_AT_10 = "recall_at_10";
    public static final String NDCG_AT_10 = "ndcg_at_10";
    public static final String TOP1_HIT_RATE = "top1_hit_rate";
    public static final String MRR = "mrr";
    public static final String RERANK_EFFECT = "rerank_effect";
    public static final String S7_CITATION_PRECISION = "s7_citation_precision";
    public static final String S7_CITATION_COVERAGE = "s7_citation_coverage";
    public static final String S7_ANSWER_SUPPORT_RATE = "s7_answer_support_rate";
    public static final String FEEDBACK_REGRESSION = "feedback_regression";

    public static final String P95_LATENCY_MS = "p95_latency_ms";
    public static final String ERROR_RATE = "error_rate";
    public static final String COST_PER_RUN = "cost_per_run";
    public static final String BACKLOG_TASKS = "backlog_tasks";

    private EvaluationMetricCode() {
    }
}
