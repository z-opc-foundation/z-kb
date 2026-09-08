package com.zifang.z.kb.starter.service;

import com.zifang.z.kb.api.ChatMessage;
import com.zifang.z.kb.api.ChatRequest;
import com.zifang.z.kb.api.ChatResponse;
import com.zifang.z.kb.api.ChatService;
import com.zifang.z.kb.api.ChatSession;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.starter.config.KBProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 默认 Chat 服务实现 — 抽取式回答 + 可选 LLM。
 *
 * <p>无 LLM 时：从检索结果中抽取关键段落拼装为带引用标记的回答。
 */
public class DefaultChatService implements ChatService {

    private static final Logger log = LoggerFactory.getLogger(DefaultChatService.class);

    private final KnowledgeBaseService kbService;
    private final SearchService searchService;
    private final KBProperties.Chat config;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final java.util.Map<String, ChatSession> sessions = new ConcurrentHashMap<>();

    public DefaultChatService(KnowledgeBaseService kbService, SearchService searchService, KBProperties.Chat config) {
        this.kbService = kbService;
        this.searchService = searchService;
        this.config = config;
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        long start = System.currentTimeMillis();
        ChatResponse response = new ChatResponse();
        response.setSessionId(request.getSessionId());

        // 1. 检索
        SearchQuery sq = SearchQuery.builder()
                .query(request.getQuestion())
                .workspace(request.getWorkspace())
                .topK(request.getTopK() > 0 ? request.getTopK() : 5)
                .build();
        SearchResult sr = searchService.search(sq);
        response.setReferences(sr.getHits());
        response.setRelatedEntities(sr.getMatchedEntities());

        // 2. 生成回答
        String answer;
        String model = "extractive";
        if (config.getEndpoint() != null && !config.getEndpoint().isEmpty()) {
            try {
                answer = callLlm(request, sr);
                model = config.getModel() != null ? config.getModel() : "http-llm";
            } catch (Exception e) {
                log.warn("LLM call failed, fallback to extractive: {}", e.getMessage());
                answer = extractiveAnswer(request, sr);
            }
        } else {
            answer = extractiveAnswer(request, sr);
        }
        response.setAnswer(answer);
        response.setModel(model);
        response.setElapsedMillis(System.currentTimeMillis() - start);

        // 3. 持久化会话消息
        if (request.getSessionId() != null) {
            ChatSession session = sessions.get(request.getSessionId());
            if (session != null) {
                ChatMessage userMsg = new ChatMessage(ChatMessage.Role.USER, request.getQuestion());
                userMsg.setSessionId(session.getId());
                session.getMessages().add(userMsg);
                ChatMessage assistant = new ChatMessage(ChatMessage.Role.ASSISTANT, answer);
                assistant.setSessionId(session.getId());
                assistant.setReferences(sr.getHits());
                assistant.setMentionedEntities(sr.getMatchedEntities());
                session.getMessages().add(assistant);
                session.setUpdatedAt(Instant.now());
            }
        }
        return response;
    }

    private String extractiveAnswer(ChatRequest request, SearchResult sr) {
        if (sr.getHits() == null || sr.getHits().isEmpty()) {
            return "抱歉，知识库中没有找到与「" + request.getQuestion() + "」相关的内容。";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("根据知识库检索，找到以下相关段落：\n\n");
        int idx = 1;
        for (SearchHit hit : sr.getHits()) {
            if (!request.isCiteReferences()) break;
            if (hit.getContent() == null) continue;
            String content = hit.getContent();
            if (content.length() > 400) content = content.substring(0, 400) + "...";
            sb.append("【").append(idx++).append("】 ");
            if (hit.getContextTitle() != null) sb.append("(").append(hit.getContextTitle()).append(") ");
            sb.append(content).append("\n\n");
        }
        sb.append("---\n");
        sb.append("提示：配置 zkb.chat.endpoint 启用 LLM 生成式回答。");
        return sb.toString();
    }

    private String callLlm(ChatRequest request, SearchResult sr) throws Exception {
        // 拼装 prompt
        StringBuilder user = new StringBuilder();
        user.append("参考资料：\n\n");
        int idx = 1;
        for (SearchHit hit : sr.getHits()) {
            if (hit.getContent() == null) continue;
            user.append("[").append(idx++).append("] ").append(hit.getContent()).append("\n\n");
        }
        user.append("\n问题：").append(request.getQuestion()).append("\n\n");
        user.append("请基于参考资料回答，并在引用处标注 [数字]。");

        ObjectNode body = mapper.createObjectNode();
        body.put("model", config.getModel());
        ArrayNode messages = mapper.createArrayNode();
        ObjectNode sysMsg = mapper.createObjectNode();
        sysMsg.put("role", "system");
        sysMsg.put("content", request.getSystemPrompt() != null ? request.getSystemPrompt() : config.getSystemPrompt());
        messages.add(sysMsg);
        ObjectNode userMsg = mapper.createObjectNode();
        userMsg.put("role", "user");
        userMsg.put("content", user.toString());
        messages.add(userMsg);
        body.set("messages", messages);
        body.put("temperature", request.getTemperature());

        HttpRequest httpReq = HttpRequest.newBuilder(URI.create(config.getEndpoint()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + (config.getApiKey() != null ? config.getApiKey() : ""))
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> resp = httpClient.send(httpReq, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) {
            throw new RuntimeException("LLM HTTP " + resp.statusCode() + ": " + resp.body());
        }
        JsonNode root = mapper.readTree(resp.body());
        JsonNode choices = root.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            return choices.get(0).path("message").path("content").asText();
        }
        return extractiveAnswer(request, sr);
    }

    @Override
    public ChatSession createSession(String workspace, String userId, String title) {
        ChatSession session = new ChatSession(workspace);
        session.setUserId(userId);
        session.setTitle(title != null ? title : "新会话");
        sessions.put(session.getId(), session);
        return session;
    }

    @Override
    public ChatSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    @Override
    public List<ChatSession> listSessions(String workspace, String userId, int limit) {
        List<ChatSession> result = new ArrayList<>();
        for (ChatSession s : sessions.values()) {
            if (!workspace.equals(s.getWorkspace())) continue;
            if (userId != null && !userId.equals(s.getUserId())) continue;
            result.add(s);
            if (result.size() >= limit) break;
        }
        return result;
    }

    @Override
    public boolean deleteSession(String sessionId) {
        return sessions.remove(sessionId) != null;
    }

    @Override
    public ChatResponse chatInSession(String sessionId, String question) {
        ChatSession session = sessions.get(sessionId);
        if (session == null) return null;
        ChatRequest req = new ChatRequest();
        req.setQuestion(question);
        req.setWorkspace(session.getWorkspace());
        req.setSessionId(sessionId);
        req.setUserId(session.getUserId());
        return chat(req);
    }
}
