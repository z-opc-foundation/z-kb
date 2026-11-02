package com.zifang.z.kb.api.concept;

import java.util.ArrayList;
import java.util.List;

/**
 * 概念详情：概念本身与最近 100 条来源提及。
 */
public class ConceptDetailView {

    private ConceptView concept;
    private List<ConceptMentionView> mentions = new ArrayList<>();

    public ConceptView getConcept() {
        return concept;
    }

    public void setConcept(ConceptView concept) {
        this.concept = concept;
    }

    public List<ConceptMentionView> getMentions() {
        return mentions;
    }

    public void setMentions(List<ConceptMentionView> mentions) {
        this.mentions = mentions;
    }
}
