package com.zifang.z.kb.storage.resource.mapper;

import java.time.LocalDate;

/**
 * 活跃度聚合行：知识库 + 自然日 + 成功操作数。
 */
public class KbActivityRow {

    private String kbId;
    private LocalDate actDate;
    private Long total;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
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
