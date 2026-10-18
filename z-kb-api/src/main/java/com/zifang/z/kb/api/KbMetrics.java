package com.zifang.z.kb.api;

/**
 * z-kb 运行时指标出口。
 *
 * <p>不引用 micrometer 任何类型：actuator 在 starter 里是 optional，下游没带 actuator 时
 * 直接用 micrometer 的类会整类加载失败。这里只定义契约，实现方在有 micrometer 时才装配。
 *
 * <p>无实现时业务侧传 null 即可，全部调用点是可选的。
 */
public interface KbMetrics {

    /**
     * 一次检索的观测值。
     *
     * @param hitsMissingContent 命中里正文为空的条数 —— 融合丢正文那类缺陷的唯一线上信号，
     *                            它恒为 0 说明一切正常，非 0 说明 RAG 在拿空上下文问答
     */
    void recordSearch(String mode, long millis, int hits, int hitsMissingContent, int degradedRoutes);

    /**
     * 一次问答的观测值。{@code model} 是四个显式取值之一：
     * 配置的模型名 / {@code extractive-llm-failed} / {@code extractive-not-configured}
     */
    void recordChat(String model, long promptTokens, long completionTokens, long millis);

    void recordIngest(int chunks, long millis);
}
