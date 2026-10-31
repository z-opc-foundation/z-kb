package com.zifang.z.kb.api.resource;

/**
 * 知识库分页查询条件（对齐参考实现 KnowledgeBasePageParam）。
 */
public class KnowledgeBaseQuery {

    /** 名称/编码模糊关键词 */
    private String keyword;
    /** 类型过滤，取 KnowledgeBaseType 名 */
    private String type;
    /** 状态过滤，取 KnowledgeBaseStatus 名；为空时默认只查 ACTIVE */
    private String status;
    /** 是否包含已归档（status 为空时生效） */
    private boolean includeArchived;
    private long current = 1;
    private long size = 10;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isIncludeArchived() {
        return includeArchived;
    }

    public void setIncludeArchived(boolean includeArchived) {
        this.includeArchived = includeArchived;
    }

    public long getCurrent() {
        return current;
    }

    public void setCurrent(long current) {
        this.current = current;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }
}
