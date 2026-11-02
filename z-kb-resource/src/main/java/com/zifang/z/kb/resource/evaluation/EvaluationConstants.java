package com.zifang.z.kb.resource.evaluation;

/**
 * 评测内核的共享常量：Judge 版本、检索上限、可采信门槛与指标备注口径。
 */
final class EvaluationConstants {

    static final String JUDGE_MODE = "LOCAL_RULE";

    static final String JUDGE_VERSION = "local-rule-v1";

    static final int TOP_K = 10;

    static final double DEFAULT_MIN_SCORE = 0.1d;

    static final int MAX_SCAN = 5000;

    static final int MAX_STATS_CHUNKS = 10000;

    static final int MAX_CASES = 200;

    static final int MAX_PAGE_SIZE = 100;

    static final long REUSE_WINDOW_HOURS = 2L;

    static final int ANSWER_CHUNK_CHARS = 300;

    static final int ANSWER_TOTAL_CHARS = 600;

    static final int OVERLONG_CHARS = 1000;

    static final double PARSE_SUCCESS_TARGET = 0.95d;

    static final double INDEX_COVERAGE_TARGET = 0.90d;

    static final double RECALL_FLOOR_TARGET = 0.80d;

    static final String REASON_TRUNCATED = "RETRIEVAL_TRUNCATED";

    static final String REASON_INDEX_LOW = "INDEX_COVERAGE_LOW";

    static final String REASON_PARSE_LOW = "PARSE_SUCCESS_LOW";

    static final String REASON_RECALL_LOW = "RECALL_AT_10_LOW";

    static final String NOTE_LOCAL = "本地代理/未校准";

    static final String NOTE_RUNTIME = "未接入 T-06/A-05，本地代理/未校准";

    static final String NOTE_NOT_CONNECTED = "本期未接入，不用估算值冒充";

    private EvaluationConstants() {
    }
}
