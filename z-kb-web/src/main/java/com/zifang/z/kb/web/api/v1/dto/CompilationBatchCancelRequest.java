package com.zifang.z.kb.web.api.v1.dto;

/**
 * 取消编译组别请求。
 */
public class CompilationBatchCancelRequest {

    private String batchId;

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }
}
