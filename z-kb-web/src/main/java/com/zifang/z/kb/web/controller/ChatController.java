package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.ChatRequest;
import com.zifang.z.kb.api.ChatResponse;
import com.zifang.z.kb.api.ChatService;
import com.zifang.z.kb.api.ChatSession;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;
import java.util.Map;

/**
 * RAG 问答 REST API。
 */
@Api(tags = "RAG 问答")
@RestController
@RequestMapping("/api/kb/chat")
public class ChatController {

    @Resource
    private ChatService chatService;

    @ApiOperation("单轮问答")
    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request) {
        if (request.getWorkspace() == null) request.setWorkspace("default");
        return chatService.chat(request);
    }

    @ApiOperation("创建会话")
    @PostMapping("/sessions")
    public ChatSession createSession(@RequestBody Map<String, Object> body) {
        String workspace = (String) body.getOrDefault("workspace", "default");
        String userId = (String) body.get("userId");
        String title = (String) body.get("title");
        return chatService.createSession(workspace, userId, title);
    }

    @ApiOperation("获取会话")
    @GetMapping("/sessions/{id}")
    public ChatSession getSession(@PathVariable String id) {
        return chatService.getSession(id);
    }

    @ApiOperation("列出会话")
    @GetMapping("/sessions")
    public List<ChatSession> listSessions(@RequestParam(defaultValue = "default") String workspace,
                                            @RequestParam(required = false) String userId,
                                            @RequestParam(defaultValue = "50") int limit) {
        return chatService.listSessions(workspace, userId, limit);
    }

    @ApiOperation("删除会话")
    @DeleteMapping("/sessions/{id}")
    public boolean deleteSession(@PathVariable String id) {
        return chatService.deleteSession(id);
    }

    @ApiOperation("在会话内提问")
    @PostMapping("/sessions/{id}/chat")
    public ChatResponse chatInSession(@PathVariable String id, @RequestBody Map<String, String> body) {
        return chatService.chatInSession(id, body.get("question"));
    }
}
