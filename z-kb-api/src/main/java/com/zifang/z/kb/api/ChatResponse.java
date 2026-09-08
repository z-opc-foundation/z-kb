package com.zifang.z.kb.api;

import java.util.ArrayList;
import java.util.List;

/**
 * RAG 问答响应。
 */
public class ChatResponse {

    private String sessionId;
    private String messageId;
    private String answer;
    private List<SearchHit> references = new ArrayList<>();
    private List<Entity> relatedEntities = new ArrayList<>();
    private long promptTokens;
    private long completionTokens;
    private long elapsedMillis;
    /** 模型名称（如 "mock-embedder" / "openai-gpt-4o"） */
    private String model;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public List<SearchHit> getReferences() { return references; }
    public void setReferences(List<SearchHit> references) { this.references = references; }
    public List<Entity> getRelatedEntities() { return relatedEntities; }
    public void setRelatedEntities(List<Entity> relatedEntities) { this.relatedEntities = relatedEntities; }
    public long getPromptTokens() { return promptTokens; }
    public void setPromptTokens(long promptTokens) { this.promptTokens = promptTokens; }
    public long getCompletionTokens() { return completionTokens; }
    public void setCompletionTokens(long completionTokens) { this.completionTokens = completionTokens; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
}
