package com.zifang.z.kb.starter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;

/**
 * z-kb 顶层配置属性（统一前缀 zkb.*）。
 */
@ConfigurationProperties(prefix = "zkb")
public class KBProperties {

    /** 启用 z-kb */
    private boolean enabled = true;

    /** Embedding 配置 */
    @NestedConfigurationProperty
    private Embedding embedding = new Embedding();

    /** Chunker 配置 */
    @NestedConfigurationProperty
    private Chunker chunker = new Chunker();

    /** Chat 配置 */
    @NestedConfigurationProperty
    private Chat chat = new Chat();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Embedding getEmbedding() { return embedding; }
    public void setEmbedding(Embedding embedding) { this.embedding = embedding; }
    public Chunker getChunker() { return chunker; }
    public void setChunker(Chunker chunker) { this.chunker = chunker; }
    public Chat getChat() { return chat; }
    public void setChat(Chat chat) { this.chat = chat; }

    public static class Embedding {
        /** 嵌入提供者类型: tfidf / http */
        private String provider = "tfidf";
        /** 维度（tfidf 512，openai 1536/3072，qwen 1024 等） */
        private int dimension = 512;
        /** HTTP 嵌入端点（OpenAI 兼容） */
        private String endpoint;
        /** 模型名 */
        private String model;
        /** API Key */
        private String apiKey;

        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
        public int getDimension() { return dimension; }
        public void setDimension(int dimension) { this.dimension = dimension; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    }

    public static class Chunker {
        private int maxTokens = 256;
        private int overlapTokens = 80;
        private int minTokens = 32;
        public int getMaxTokens() { return maxTokens; }
        public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
        public int getOverlapTokens() { return overlapTokens; }
        public void setOverlapTokens(int overlapTokens) { this.overlapTokens = overlapTokens; }
        public int getMinTokens() { return minTokens; }
        public void setMinTokens(int minTokens) { this.minTokens = minTokens; }
    }

    public static class Chat {
        /** 是否启用 RAG 回答（无 LLM 时退化为抽取式） */
        private boolean enabled = true;
        /** LLM 端点（OpenAI 兼容）；为空时用抽取式 */
        private String endpoint;
        private String model;
        private String apiKey;
        /** 默认 system prompt */
        private String systemPrompt = "你是 z-kb 知识库助手，基于以下参考资料回答用户问题。当参考资料不足时，明确告知用户。回答时标注引用源编号。";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getSystemPrompt() { return systemPrompt; }
        public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }
    }
}
