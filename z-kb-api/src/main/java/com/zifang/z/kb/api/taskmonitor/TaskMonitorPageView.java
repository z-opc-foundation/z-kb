package com.zifang.z.kb.api.taskmonitor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 调度任务分页结果（对齐参考实现 TaskMonitorPageResponse）。
 */
public class TaskMonitorPageView {

    private long total;
    private int pageNo;
    private int pageSize;
    private List<TaskMonitorView> records = new ArrayList<>();

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public int getPageNo() {
        return pageNo;
    }

    public void setPageNo(int pageNo) {
        this.pageNo = pageNo;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public List<TaskMonitorView> getRecords() {
        return records;
    }

    public void setRecords(List<TaskMonitorView> records) {
        this.records = records;
    }
}
