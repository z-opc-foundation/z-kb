package com.zifang.z.kb.protocol.request;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 会话内提问请求 —— {@code POST /api/kb/chat/sessions/{id}/chat}。
 */
@Schema(description = "会话内提问请求")
public class SessionChatRequest {

    @Schema(description = "问题正文", example = "这个知识库能回答哪些问题？", requiredMode = Schema.RequiredMode.REQUIRED)
    private String question;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
}
