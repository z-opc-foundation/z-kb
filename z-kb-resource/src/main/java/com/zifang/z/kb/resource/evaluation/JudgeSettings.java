package com.zifang.z.kb.resource.evaluation;

import java.util.LinkedHashMap;
import java.util.Map;

import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.JUDGE_MODE;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.JUDGE_VERSION;
import static com.zifang.z.kb.resource.evaluation.EvaluationConstants.NOTE_LOCAL;

/**
 * 评测判定参数：检索返回条数与最低分，来自评测任务配置。
 */
final class JudgeSettings {

    double minScore;

    int topK;

    Map<String, Object> config() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("judgeMode", JUDGE_MODE);
        config.put("judgeVersion", JUDGE_VERSION);
        config.put("minScore", minScore);
        config.put("topK", topK);
        config.put("calibration", NOTE_LOCAL);
        return config;
    }
}
