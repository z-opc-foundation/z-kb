package com.zifang.z.kb.web.api.v1.dto;

/**
 * 单任务重试请求。startStage 支持 REGISTER/PARSE/CHUNK/INDEX/EXTRACT 或 P0–P4，缺省 P0。
 */
public class CompilationRetryRequest {

    private String jobId;
    private String startStage;

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public String getStartStage() {
        return startStage;
    }

    public void setStartStage(String startStage) {
        this.startStage = startStage;
    }
}
