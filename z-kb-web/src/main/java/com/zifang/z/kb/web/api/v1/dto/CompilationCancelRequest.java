package com.zifang.z.kb.web.api.v1.dto;

/**
 * 取消编译请求。
 */
public class CompilationCancelRequest {

    private String jobId;

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }
}
