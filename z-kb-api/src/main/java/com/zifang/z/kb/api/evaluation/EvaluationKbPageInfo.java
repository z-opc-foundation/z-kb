package com.zifang.z.***REMOVED***.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 评测口径下的知识库分页。
 */
public class Evaluation***REMOVED***PageInfo {

    private List<Evaluation***REMOVED***ItemInfo> records = new ArrayList<>();
    private long total;

    public List<Evaluation***REMOVED***ItemInfo> getRecords() {
        return records;
    }

    public void setRecords(List<Evaluation***REMOVED***ItemInfo> records) {
        this.records = records;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
