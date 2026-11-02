package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 坏例台账列表。
 */
public class EvalBadcaseListInfo {

    private List<EvalBadcaseInfo> records = new ArrayList<>();
    private long total;

    public List<EvalBadcaseInfo> getRecords() {
        return records;
    }

    public void setRecords(List<EvalBadcaseInfo> records) {
        this.records = records;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
