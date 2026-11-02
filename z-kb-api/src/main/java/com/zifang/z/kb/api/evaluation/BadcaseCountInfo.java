package com.zifang.z.kb.api.evaluation;

/**
 * 坏例数量统计：未处理、已修复与回归。
 */
public class BadcaseCountInfo {

    private long open;
    private long fixed;
    private long regressed;

    public long getOpen() {
        return open;
    }

    public void setOpen(long open) {
        this.open = open;
    }

    public long getFixed() {
        return fixed;
    }

    public void setFixed(long fixed) {
        this.fixed = fixed;
    }

    public long getRegressed() {
        return regressed;
    }

    public void setRegressed(long regressed) {
        this.regressed = regressed;
    }
}
