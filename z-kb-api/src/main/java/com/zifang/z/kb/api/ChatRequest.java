package com.zifang.z.kb.api;

/**
 * RAG 问答请求。
 */
public class ChatRequest {

    private String question;
    private String workspace = "default";
    private String sessionId;
    private String userId;
    private int topK = 5;
    private double temperature = 0.7;
    private String systemPrompt;
    private boolean stream = false;
    /** 是否在回答中标注引用源（默认 true） */
    private boolean citeReferences = true;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public int getTopK() { return topK; }
    public void setTopK(int topK) { this.topK = topK; }
    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }
    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }
    public boolean isStream() { return stream; }
    public void setStream(boolean stream) { this.stream = stream; }
    public boolean isCiteReferences() { return citeReferences; }
    public void setCiteReferences(boolean citeReferences) { this.citeReferences = citeReferences; }
}
