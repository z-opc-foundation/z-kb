package com.zifang.z.kb.web.api.v1.dto;

import java.util.List;

/**
 * 活跃度（热力图）请求。
 */
public class KnowledgeBaseActivityRequest {

    private List<String> kbIds;
    private Integer days;

    public List<String> getKbIds() {
        return kbIds;
    }

    public void setKbIds(List<String> kbIds) {
        this.kbIds = kbIds;
    }

    public Integer getDays() {
        return days;
    }

    public void setDays(Integer days) {
        this.days = days;
    }
}
