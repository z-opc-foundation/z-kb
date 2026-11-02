package com.zifang.z.kb.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 对话消息 — 问答会话的最小单元。
 */
public class ChatMessage {

    public enum Role { USER, ASSISTANT, SYSTEM }

    private String id;
    private String sessionId;
    private Role role;
    private String content;
    private List<SearchHit> references = new ArrayList<>();
    private List<Entity> mentionedEntities = new ArrayList<>();
    private long promptTokens;
    private long completionTokens;
    private long totalTokens;
    private Instant createdAt = Instant.now();

    public ChatMessage() { this.id = UUID.randomUUID().toString(); }
    public ChatMessage(Role role, String content) { this(); this.role = role; this.content = content; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public List<SearchHit> getReferences() { return references; }
    public void setReferences(List<SearchHit> references) { this.references = references; }
    public List<Entity> getMentionedEntities() { return mentionedEntities; }
    public void setMentionedEntities(List<Entity> mentionedEntities) { this.mentionedEntities = mentionedEntities; }
    public long getPromptTokens() { return promptTokens; }
    public void setPromptTokens(long promptTokens) { this.promptTokens = promptTokens; }
    public long getCompletionTokens() { return completionTokens; }
    public void setCompletionTokens(long completionTokens) { this.completionTokens = completionTokens; }
    public long getTotalTokens() { return totalTokens; }
    public void setTotalTokens(long totalTokens) { this.totalTokens = totalTokens; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
