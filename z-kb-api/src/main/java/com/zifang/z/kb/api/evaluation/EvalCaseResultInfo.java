package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 逐题评测结果。
 */
public class EvalCaseResultInfo {

    private String caseId;
    private Integer caseNo;
    private String question;
    private String answer;
    private String answerMode;
    private Object metrics;
    private Object retrieved;
    private Object citations;
    private Object stageTrace;
    private Long latencyMs;
    private String errorMessage;
    private List<String> badcaseStages = new ArrayList<>();

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public Integer getCaseNo() {
        return caseNo;
    }

    public void setCaseNo(Integer caseNo) {
        this.caseNo = caseNo;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getAnswerMode() {
        return answerMode;
    }

    public void setAnswerMode(String answerMode) {
        this.answerMode = answerMode;
    }

    public Object getMetrics() {
        return metrics;
    }

    public void setMetrics(Object metrics) {
        this.metrics = metrics;
    }

    public Object getRetrieved() {
        return retrieved;
    }

    public void setRetrieved(Object retrieved) {
        this.retrieved = retrieved;
    }

    public Object getCitations() {
        return citations;
    }

    public void setCitations(Object citations) {
        this.citations = citations;
    }

    public Object getStageTrace() {
        return stageTrace;
    }

    public void setStageTrace(Object stageTrace) {
        this.stageTrace = stageTrace;
    }

    public Long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(Long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public List<String> getBadcaseStages() {
        return badcaseStages;
    }

    public void setBadcaseStages(List<String> badcaseStages) {
        this.badcaseStages = badcaseStages;
    }
}
