package com.zifang.z.kb.api.resource;

/**
 * 库级动作码（角色-动作矩阵的取值）。
 */
public enum KnowledgeBaseAction {
    KB_READ("kb.read"),
    KB_MANAGE("kb.manage"),
    MEMBER_MANAGE("member.manage"),
    MATERIAL_WRITE("material.write"),
    MATERIAL_REVIEW("material.review"),
    COMPILATION_RUN("compilation.run"),
    WIKI_READ("wiki.read"),
    RETRIEVAL_QUERY("retrieval.query"),
    LINEAGE_READ("lineage.read");

    private final String code;

    KnowledgeBaseAction(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
