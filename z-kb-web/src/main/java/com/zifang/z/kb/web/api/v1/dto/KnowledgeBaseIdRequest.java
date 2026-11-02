package com.zifang.z.kb.web.api.v1.dto;

/**
 * 仅携带 kbId 的请求（归档/恢复/删除/校验草稿等）。
 */
public class KnowledgeBaseIdRequest {

    private String kbId;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }
}
