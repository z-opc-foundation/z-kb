package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 逐题结果分页。
 */
public class EvalCaseResultPageInfo {

    private List<EvalCaseResultInfo> records = new ArrayList<>();
    private long total;

    public List<EvalCaseResultInfo> getRecords() {
        return records;
    }

    public void setRecords(List<EvalCaseResultInfo> records) {
        this.records = records;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
