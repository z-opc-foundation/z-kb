package com.zifang.z.***REMOVED***.storage.resource.mapper;

import java.time.LocalDate;

/**
 * 活跃度聚合行：知识库 + 自然日 + 成功操作数。
 */
public class ***REMOVED***ActivityRow {

    private String ***REMOVED***Id;
    private LocalDate actDate;
    private Long total;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public LocalDate getActDate() {
        return actDate;
    }

    public void setActDate(LocalDate actDate) {
        this.actDate = actDate;
    }

    public Long getTotal() {
        return total;
    }

    public void setTotal(Long total) {
        this.total = total;
    }
}
