package com.zifang.z.kb.protocol.request;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 会话内提问请求 —— {@code POST /api/kb/chat/sessions/{id}/chat}。
 */
@ApiModel(description = "会话内提问请求")
public class SessionChatRequest {

    @ApiModelProperty(value = "问题正文", required = true, example = "这个知识库能回答哪些问题？")
    private String question;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
}
