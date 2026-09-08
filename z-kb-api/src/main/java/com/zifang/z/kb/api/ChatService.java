package com.zifang.z.kb.api;

/**
 * RAG 问答服务 — 基于检索增强的对话生成。
 *
 * <p>当未配置 LLM 时，进入"抽取式回答"模式：
 * 直接将 topK 命中的块拼装为带引用标记的回答，便于本地离线运行。
 */
public interface ChatService {

    /** 单轮问答（不带历史） */
    ChatResponse chat(ChatRequest request);

    /** 创建会话 */
    ChatSession createSession(String workspace, String userId, String title);

    /** 获取会话 */
    ChatSession getSession(String sessionId);

    /** 列出工作台内全部会话 */
    java.util.List<ChatSession> listSessions(String workspace, String userId, int limit);

    /** 删除会话 */
    boolean deleteSession(String sessionId);

    /** 在会话内提问（自动追加消息） */
    ChatResponse chatInSession(String sessionId, String question);
}
