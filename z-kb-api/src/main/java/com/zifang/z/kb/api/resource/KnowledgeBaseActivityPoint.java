package com.zifang.z.***REMOVED***.api.resource;

/**
 * 知识库单日活跃点（对齐参考实现 ***REMOVED***ActivityDayResponse）。
 */
public class KnowledgeBaseActivityPoint {

    /** 自然日，格式 yyyy-MM-dd */
    private String date;
    private long count;

    public KnowledgeBaseActivityPoint() {
    }

    public KnowledgeBaseActivityPoint(String date, long count) {
        this.date = date;
        this.count = count;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public long getCount() {
        return count;
    }

    public void setCount(long count) {
        this.count = count;
    }
}
