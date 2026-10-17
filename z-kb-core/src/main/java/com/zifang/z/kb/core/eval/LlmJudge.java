package com.zifang.z.kb.core.eval;

import com.zifang.util.http.client.HttpExecutionResult;
import com.zifang.util.http.client.HttpExecutor;
import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生成侧裁判 — 走任意 OpenAI 兼容端点（默认 .249 上的 Ollama）做 LLM-as-judge。
 *
 * <p>裁判温度恒为 0 且只回一个数字，避免「同一次评测跑两遍结论不同」。
 *
 * <p>选型注意：裁判模型必须选<b>无 thinking</b> 的（如 qwen2.5:14b-instruct）。
 * 带思维链的模型会把推理写进 content，解析出的分数全是噪声 —— 裁判要的是稳定，不是深度。
 */
public class LlmJudge {

    private final String endpoint;
    private final String model;
    private HttpExecutor httpExecutor;

    public LlmJudge(String endpoint, String model) {
        this.endpoint = endpoint;
        this.model = model;
    }

    public void setHttpExecutor(HttpExecutor httpExecutor) {
        this.httpExecutor = httpExecutor;
    }

    /** 纯生成，不带裁判提示 —— 供「有检索 / 无检索」两臂共用同一套生成路径 */
    public String generate(String systemPrompt, String userPrompt, int maxTokens) {
        List<Map<String, Object>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isEmpty()) {
            messages.add(message("system", systemPrompt));
        }
        messages.add(message("user", userPrompt));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", 0);
        body.put("max_tokens", maxTokens);

        JsonCursor root = call(body);
        return root.path("choices").at(0).path("message").path("content").asText();
    }

    /**
     * 让裁判只回一个 0-10 的整数。解析失败按 0 分计并保留原文，
     * 不静默当成满分 —— 裁判挂掉时最危险的是产出一份看着很美的假报告。
     */
    public int score(String instruction, String subject, int maxScore) {
        String prompt = instruction + "\n\n【待评内容】\n" + subject
                + "\n\n只输出一个 0 到 " + maxScore + " 的整数，不要任何解释、标点或其他文字。";
        String raw;
        try {
            raw = generate(null, prompt, 24);
        } catch (RuntimeException e) {
            return 0;
        }
        return parseScore(raw, maxScore);
    }

    static int parseScore(String raw, int maxScore) {
        if (raw == null) {
            return 0;
        }
        java.util.regex.Matcher m =
                java.util.regex.Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(raw.trim());
        if (!m.find()) {
            return 0;
        }
        try {
            double v = Double.parseDouble(m.group(1));
            int scaled = (int) Math.round(v);
            if (scaled < 0) {
                return 0;
            }
            return Math.min(scaled, maxScore);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private JsonCursor call(Map<String, Object> body) {
        HttpExecutor exec = httpExecutor != null ? httpExecutor : HttpExecutor.getDefault();
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Content-Type", "application/json");
        HttpExecutionResult resp =
                exec.executeByMethodUrl("POST", endpoint, headers, JsonUtil.toJson(body));
        if (resp.getStatus() / 100 != 2) {
            throw new IllegalStateException("LLM 调用失败 HTTP " + resp.getStatus() + ": " + resp.getBody());
        }
        return JsonCursor.of(JsonUtil.parse(resp.getBody()));
    }

    private static Map<String, Object> message(String role, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
