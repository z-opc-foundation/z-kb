package com.zifang.z.kb.api;

import java.util.List;

/**
 * Embedding 提供者抽象接口。
 *
 * <p>设计原则：核心引擎不绑定具体 Embedding 模型。
 * <ul>
 *   <li>{@link #embed(String)} — 单文本向量化</li>
 *   <li>{@link #embedBatch(List)} — 批量向量化（推荐，避免循环调用远程 API）</li>
 *   <li>{@link #dimension()} — 向量维度（用于建 Collection 时校验）</li>
 *   <li>{@link #providerName()} — 提供者名称（持久化到 Chunk 元数据，便于追溯）</li>
 * </ul>
 *
 * <p>内置实现：
 * <ul>
 *   <li>{@code TfIdfEmbeddingProvider}（z-kb-core）— 离线 TF-IDF + 字符 n-gram hash，512 维</li>
 *   <li>{@code HttpEmbeddingProvider}（z-kb-core）— 调用 OpenAI/Qwen/GLM 等远程 API</li>
 * </ul>
 *
 * <h2>使用示例</h2>
 * <pre>{@code
 * EmbeddingProvider provider = new TfIdfEmbeddingProvider(512);
 * float[] vector = provider.embed("InfluxDB 是时序数据库");
 * }</pre>
 */
public interface EmbeddingProvider {

    /**
     * 单文本向量化。
     *
     * @param text 输入文本
     * @return 与 {@link #dimension()} 等长的浮点向量
     * @throws KBException 当输入非法或远端调用失败
     */
    float[] embed(String text);

    /**
     * 批量向量化（推荐）。
     *
     * @param texts 输入文本列表
     * @return 与输入顺序等长的向量列表
     */
    List<float[]> embedBatch(List<String> texts);

    /**
     * 向量维度。
     */
    int dimension();

    /**
     * 提供者名称（"tfidf-local" / "openai-text-embedding-3-small" 等）。
     */
    String providerName();
}
