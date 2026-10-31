package com.zifang.z.kb.api.extraction;

import java.util.ArrayList;
import java.util.List;

/**
 * 按物料查询的萃取产物：摘要、问句、术语、FAQ 与计数。
 */
public class ExtractionMaterialView {

    private String materialId;
    private String materialVersionId;
    private String milestone;
    private ExtractionCountView counts;
    private ExtractionItemView summary;
    private List<ExtractionItemView> questions = new ArrayList<>();
    private List<ExtractionItemView> terms = new ArrayList<>();
    private List<ExtractionItemView> faqs = new ArrayList<>();

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getMilestone() {
        return milestone;
    }

    public void setMilestone(String milestone) {
        this.milestone = milestone;
    }

    public ExtractionCountView getCounts() {
        return counts;
    }

    public void setCounts(ExtractionCountView counts) {
        this.counts = counts;
    }

    public ExtractionItemView getSummary() {
        return summary;
    }

    public void setSummary(ExtractionItemView summary) {
        this.summary = summary;
    }

    public List<ExtractionItemView> getQuestions() {
        return questions;
    }

    public void setQuestions(List<ExtractionItemView> questions) {
        this.questions = questions;
    }

    public List<ExtractionItemView> getTerms() {
        return terms;
    }

    public void setTerms(List<ExtractionItemView> terms) {
        this.terms = terms;
    }

    public List<ExtractionItemView> getFaqs() {
        return faqs;
    }

    public void setFaqs(List<ExtractionItemView> faqs) {
        this.faqs = faqs;
    }
}
