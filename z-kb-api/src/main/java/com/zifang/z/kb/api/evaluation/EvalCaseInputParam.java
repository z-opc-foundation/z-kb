package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * QA 题目草稿条目。
 */
public class EvalCaseInputParam {

    private Integer caseNo;
    private String question;
    private String expectedAnswer;
    private String expectedBehavior;
    private Object expectedEvidence;
    private List<String> tags = new ArrayList<>();
    private String entryType;

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

    public String getExpectedAnswer() {
        return expectedAnswer;
    }

    public void setExpectedAnswer(String expectedAnswer) {
        this.expectedAnswer = expectedAnswer;
    }

    public String getExpectedBehavior() {
        return expectedBehavior;
    }

    public void setExpectedBehavior(String expectedBehavior) {
        this.expectedBehavior = expectedBehavior;
    }

    public Object getExpectedEvidence() {
        return expectedEvidence;
    }

    public void setExpectedEvidence(Object expectedEvidence) {
        this.expectedEvidence = expectedEvidence;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getEntryType() {
        return entryType;
    }

    public void setEntryType(String entryType) {
        this.entryType = entryType;
    }
}
