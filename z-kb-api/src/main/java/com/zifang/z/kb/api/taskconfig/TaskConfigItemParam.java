package com.zifang.z.kb.api.taskconfig;

/**
 * 任务配置发布项。整版发布必须覆盖全部任务性质。
 */
public class TaskConfigItemParam {

    private String taskNature;
    private String executionMode;
    private String executor;
    private String agentCode;
    private String model;
    private String skills;
    private String tools;
    private String promptVersion;
    private String outputContract;
    private Integer timeoutSeconds;
    private Integer retryLimit;
    private String boundaryNote;

    public String getTaskNature() {
        return taskNature;
    }

    public void setTaskNature(String taskNature) {
        this.taskNature = taskNature;
    }

    public String getExecutionMode() {
        return executionMode;
    }

    public void setExecutionMode(String executionMode) {
        this.executionMode = executionMode;
    }

    public String getExecutor() {
        return executor;
    }

    public void setExecutor(String executor) {
        this.executor = executor;
    }

    public String getAgentCode() {
        return agentCode;
    }

    public void setAgentCode(String agentCode) {
        this.agentCode = agentCode;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getSkills() {
        return skills;
    }

    public void setSkills(String skills) {
        this.skills = skills;
    }

    public String getTools() {
        return tools;
    }

    public void setTools(String tools) {
        this.tools = tools;
    }

    public String getPromptVersion() {
        return promptVersion;
    }

    public void setPromptVersion(String promptVersion) {
        this.promptVersion = promptVersion;
    }

    public String getOutputContract() {
        return outputContract;
    }

    public void setOutputContract(String outputContract) {
        this.outputContract = outputContract;
    }

    public Integer getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(Integer timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public Integer getRetryLimit() {
        return retryLimit;
    }

    public void setRetryLimit(Integer retryLimit) {
        this.retryLimit = retryLimit;
    }

    public String getBoundaryNote() {
        return boundaryNote;
    }

    public void setBoundaryNote(String boundaryNote) {
        this.boundaryNote = boundaryNote;
    }
}
