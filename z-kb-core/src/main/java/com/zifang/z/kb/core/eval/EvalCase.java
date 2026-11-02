package com.zifang.z.kb.core.eval;

import java.util.ArrayList;
import java.util.List;

/**
 * 黄金集单条用例。
 *
 * <p>{@code expectedChunkIds} 为空且 {@code isUnanswerable} 为 true 时，该用例度量的是
 * 「知识库外问题能不能被正确拒答」，不参与常规召回率分母。
 */
public class EvalCase {

    private String caseId;
    private String question;
    /** 回答该问题必须召回的证据切片 —— 召回率指标的唯一判据 */
    private List<String> expectedChunkIds = new ArrayList<>();
    /**
     * 标注粒度更粗的形态：直接写文档 id。分块策略一改 chunk id 就全变，文档 id 不变，
     * 因此标注按文档写、由评测方在建库时展开成 chunk id，避免每次改分块都要重标。
     */
    private List<String> expectedDocIds = new ArrayList<>();
    /** 专家确认的标准答案，生成侧评测用 */
    private String groundTruth;
    /** 知识库外问题：期望系统拒答而非硬凑 */
    private boolean isUnanswerable;
    /** real_log / bad_case / expert_boundary / expert_basic */
    private String sourceType;
    /** 所属知识域，用于按域分组看指标，避免总体均值掩盖局部问题 */
    private String topic;
    /** 简单 / 中等 / 困难 */
    private String difficulty;
    private String note;

    public String getCaseId() { return caseId; }
    public void setCaseId(String caseId) { this.caseId = caseId; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public List<String> getExpectedChunkIds() { return expectedChunkIds; }
    public void setExpectedChunkIds(List<String> expectedChunkIds) { this.expectedChunkIds = expectedChunkIds; }

    public List<String> getExpectedDocIds() { return expectedDocIds; }
    public void setExpectedDocIds(List<String> expectedDocIds) { this.expectedDocIds = expectedDocIds; }

    public String getGroundTruth() { return groundTruth; }
    public void setGroundTruth(String groundTruth) { this.groundTruth = groundTruth; }

    public boolean isUnanswerable() { return isUnanswerable; }
    public void setUnanswerable(boolean unanswerable) { this.isUnanswerable = unanswerable; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    /** 参与召回率分母的用例：不可答问题不计入 */
    public boolean isScoredForRetrieval() {
        return !isUnanswerable && expectedChunkIds != null && !expectedChunkIds.isEmpty();
    }
}
