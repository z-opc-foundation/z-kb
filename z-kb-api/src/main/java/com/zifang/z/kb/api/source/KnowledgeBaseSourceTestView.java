package com.zifang.z.kb.api.source;

/**
 * 接入源连通性探测结果：只回答能不能连通，不落库、不产生任务。
 */
public class KnowledgeBaseSourceTestView {

    private boolean reachable;
    private String message;
    private long latencyMs;

    public boolean isReachable() {
        return reachable;
    }

    public void setReachable(boolean reachable) {
        this.reachable = reachable;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(long latencyMs) {
        this.latencyMs = latencyMs;
    }
}
