package com.zifang.z.kb.core.eval;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生成侧评测报告 —— 两个实验臂的对照结果。
 *
 * <p>{@code WITH_RETRIEVAL} 与 {@code NO_RETRIEVAL} 的差值就是「检索增强到底增强了多少」。
 * 只报 WITH_RETRIEVAL 一臂没有意义：分数高可能来自模型自身的世界知识，与检索无关。
 */
public class GenerationEvalReport {

    public static class Arm {
        public final String name;
        private double faithfulness;
        private double answerRelevancy;
        private double correctness;
        private int sampleSize;
        public final List<CaseScore> cases = new ArrayList<>();

        Arm(String name) {
            this.name = name;
        }

        public double getFaithfulness() { return faithfulness; }
        public void setFaithfulness(double v) { this.faithfulness = v; }

        public double getAnswerRelevancy() { return answerRelevancy; }
        public void setAnswerRelevancy(double v) { this.answerRelevancy = v; }

        public double getCorrectness() { return correctness; }
        public void setCorrectness(double v) { this.correctness = v; }

        public int getSampleSize() { return sampleSize; }
        public void setSampleSize(int v) { this.sampleSize = v; }
    }

    /** 单条生成侧打分。correctness 为两臂共有的对照主指标；faithfulness=-1 表示该臂不适用 */
    public static class CaseScore {
        public final String caseId;
        public final String question;
        public final String answer;
        public final int correctness;
        public final int faithfulness;
        public final int answerRelevancy;
        public final List<String> contextChunkIds;

        CaseScore(String caseId, String question, String answer, int correctness, int faithfulness,
                  int answerRelevancy, List<String> contextChunkIds) {
            this.caseId = caseId;
            this.question = question;
            this.answer = answer;
            this.correctness = correctness;
            this.faithfulness = faithfulness;
            this.answerRelevancy = answerRelevancy;
            this.contextChunkIds = contextChunkIds;
        }
    }

    private String datasetVersion;
    private String knowledgeVersion;
    private String judgeModel;
    private String generationModel;
    private final Map<String, Arm> arms = new LinkedHashMap<>();

    public String getDatasetVersion() { return datasetVersion; }
    public void setDatasetVersion(String v) { this.datasetVersion = v; }

    public String getKnowledgeVersion() { return knowledgeVersion; }
    public void setKnowledgeVersion(String v) { this.knowledgeVersion = v; }

    public String getJudgeModel() { return judgeModel; }
    public void setJudgeModel(String v) { this.judgeModel = v; }

    public String getGenerationModel() { return generationModel; }
    public void setGenerationModel(String v) { this.generationModel = v; }

    public Map<String, Arm> getArms() { return arms; }
}
