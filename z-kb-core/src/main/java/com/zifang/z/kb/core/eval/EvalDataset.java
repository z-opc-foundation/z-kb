package com.zifang.z.kb.core.eval;

import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;

import java.util.ArrayList;
import java.util.List;

/**
 * 黄金数据集 — 带版本号的一份标注集。
 *
 * <p>{@code datasetVersion} 与 {@code knowledgeVersion} 必须同时记录：改了语料却不改
 * knowledgeVersion，两次实验的召回率就不可比。这是评测实验最容易踩的坑。
 */
public class EvalDataset {

    private String datasetVersion;
    private String knowledgeVersion;
    private List<EvalCase> cases = new ArrayList<>();

    public String getDatasetVersion() { return datasetVersion; }
    public void setDatasetVersion(String v) { this.datasetVersion = v; }

    public String getKnowledgeVersion() { return knowledgeVersion; }
    public void setKnowledgeVersion(String v) { this.knowledgeVersion = v; }

    public List<EvalCase> getCases() { return cases; }
    public void setCases(List<EvalCase> cases) { this.cases = cases; }

    /**
     * 从 JSON 文本解析。期望结构：
     * <pre>
     * { "datasetVersion": "v1", "knowledgeVersion": "kb-2026-10-18",
     *   "cases": [ { "caseId": "...", "question": "...",
     *                "expectedChunkIds": ["..."], "groundTruth": "...",
     *                "isUnanswerable": false, "sourceType": "...", "topic": "...",
     *                "difficulty": "..." } ] }
     * </pre>
     */
    public static EvalDataset parse(String json) {
        JsonCursor root = JsonCursor.of(JsonUtil.parse(json));
        EvalDataset ds = new EvalDataset();
        ds.setDatasetVersion(root.path("datasetVersion").asText());
        ds.setKnowledgeVersion(root.path("knowledgeVersion").asText());

        List<EvalCase> cases = new ArrayList<>();
        JsonCursor arr = root.path("cases");
        if (arr.isArray()) {
            for (JsonCursor item : arr.elements()) {
                EvalCase c = new EvalCase();
                c.setCaseId(item.path("caseId").asText());
                c.setQuestion(item.path("question").asText());
                c.setGroundTruth(item.path("groundTruth").asText());
                c.setUnanswerable(item.path("isUnanswerable").asBoolean(false));
                c.setSourceType(item.path("sourceType").asText());
                c.setTopic(item.path("topic").asText());
                c.setDifficulty(item.path("difficulty").asText());
                c.setNote(item.path("note").asText());

                c.setExpectedChunkIds(strings(item.path("expectedChunkIds")));
                c.setExpectedDocIds(strings(item.path("expectedDocIds")));
                cases.add(c);
            }
        }
        ds.setCases(cases);
        return ds;
    }

    private static List<String> strings(JsonCursor arr) {
        List<String> out = new ArrayList<>();
        if (arr.isArray()) {
            for (JsonCursor e : arr.elements()) {
                String s = e.asText();
                if (s != null && !s.isEmpty()) {
                    out.add(s);
                }
            }
        }
        return out;
    }
}
