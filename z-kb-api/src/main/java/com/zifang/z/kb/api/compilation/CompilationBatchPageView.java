package com.zifang.z.kb.api.compilation;

import java.util.ArrayList;
import java.util.List;

/**
 * 编译组别分页结果。分页与提交人均由后端提供。
 */
public class CompilationBatchPageView {

    private List<CompilationBatchView> records = new ArrayList<>();
    private long total;
    private int pageNo;
    private int pageSize;

    public List<CompilationBatchView> getRecords() {
        return records;
    }

    public void setRecords(List<CompilationBatchView> records) {
        this.records = records;
    }

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
}
