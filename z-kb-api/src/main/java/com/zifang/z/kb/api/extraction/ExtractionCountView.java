package com.zifang.z.kb.api.extraction;

/**
 * 一份物料版本的萃取产物计数（摘要/问句/术语/FAQ 与图谱节点/边）。
 */
public class ExtractionCountView {

    private int summary = 0;
    private int question = 0;
    private int term = 0;
    private int faq = 0;
    private int graphNode = 0;
    private int graphEdge = 0;

    public int getSummary() {
        return summary;
    }

    public void setSummary(int summary) {
        this.summary = summary;
    }

    public int getQuestion() {
        return question;
    }

    public void setQuestion(int question) {
        this.question = question;
    }

    public int getTerm() {
        return term;
    }

    public void setTerm(int term) {
        this.term = term;
    }

    public int getFaq() {
        return faq;
    }

    public void setFaq(int faq) {
        this.faq = faq;
    }

    public int getGraphNode() {
        return graphNode;
    }

    public void setGraphNode(int graphNode) {
        this.graphNode = graphNode;
    }

    public int getGraphEdge() {
        return graphEdge;
    }

    public void setGraphEdge(int graphEdge) {
        this.graphEdge = graphEdge;
    }
}
