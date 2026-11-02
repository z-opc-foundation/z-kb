package com.zifang.z.kb.web.api.v1.dto;

/**
 * 知识库更新请求。
 */
public class KnowledgeBaseUpdateRequest {

    private String kbId;
    private String name;
    private String description;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
