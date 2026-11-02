package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 评测口径下的知识库分页。
 */
public class EvaluationKbPageInfo {

    private List<EvaluationKbItemInfo> records = new ArrayList<>();
    private long total;

    public List<EvaluationKbItemInfo> getRecords() {
        return records;
    }

    public void setRecords(List<EvaluationKbItemInfo> records) {
        this.records = records;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
