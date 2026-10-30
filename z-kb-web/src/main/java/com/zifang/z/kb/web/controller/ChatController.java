package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.ChatRequest;
import com.zifang.z.kb.api.ChatResponse;
import com.zifang.z.kb.api.ChatService;
import com.zifang.z.kb.api.ChatSession;
import com.zifang.z.kb.protocol.request.CreateSessionRequest;
import com.zifang.z.kb.protocol.request.SessionChatRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.List;

/**
 * RAG 问答 REST API。
 */
@Tag(name = "RAG 问答")
@RestController
@RequestMapping("/api/kb/chat")
public class ChatController {

    @Resource
    private ChatService chatService;

    @Operation(summary = "单轮问答")
    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request) {
        if (request.getWorkspace() == null) request.setWorkspace("default");
        return chatService.chat(request);
    }

    @Operation(summary = "创建会话")
    @PostMapping("/sessions")
    public ChatSession createSession(@RequestBody CreateSessionRequest body) {
        return chatService.createSession(body.getWorkspace(), body.getUserId(), body.getTitle());
    }

    @Operation(summary = "获取会话")
    @GetMapping("/sessions/{id}")
    public ChatSession getSession(@PathVariable String id) {
        return chatService.getSession(id);
    }

    @Operation(summary = "列出会话")
    @GetMapping("/sessions")
    public List<ChatSession> listSessions(@RequestParam(defaultValue = "default") String workspace,
                                            @RequestParam(required = false) String userId,
                                            @RequestParam(defaultValue = "50") int limit) {
        return chatService.listSessions(workspace, userId, limit);
    }

    @Operation(summary = "删除会话")
    @DeleteMapping("/sessions/{id}")
    public boolean deleteSession(@PathVariable String id) {
        return chatService.deleteSession(id);
    }

    @Operation(summary = "在会话内提问")
    @PostMapping("/sessions/{id}/chat")
    public ChatResponse chatInSession(@PathVariable String id, @RequestBody SessionChatRequest body) {
        return chatService.chatInSession(id, body.getQuestion());
    }
}
