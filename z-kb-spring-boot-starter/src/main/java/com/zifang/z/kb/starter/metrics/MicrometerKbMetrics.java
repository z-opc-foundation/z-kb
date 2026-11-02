package com.zifang.z.kb.starter.metrics;

import com.zifang.z.kb.api.KbMetrics;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import java.util.concurrent.TimeUnit;

/**
 * 把 {@link KbMetrics} 落到 micrometer，暴露在 {@code /actuator/metrics}。
 *
 * <p>只在有 micrometer 时装配（见 KBAutoConfiguration 的 {@code @ConditionalOnClass}），
 * 否则整类不加载。
 */
public class MicrometerKbMetrics implements KbMetrics {

    private static final String P = "z_kb.";

    private final MeterRegistry registry;

    public MicrometerKbMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void recordSearch(String mode, long millis, int hits, int hitsMissingContent, int degradedRoutes) {
        String tag = safe(mode);
        Timer.builder(P + "search")
                .description("z-kb 检索耗时")
                .tag("mode", tag)
                .publishPercentiles(0.5, 0.95)
                .register(registry)
                .record(millis, TimeUnit.MILLISECONDS);

        registry.counter(P + "search.hits", "mode", tag).increment(hits);

        if (hitsMissingContent > 0) {
            registry.counter(P + "search.hits.missing.content", "mode", tag).increment(hitsMissingContent);
        }
        if (degradedRoutes > 0) {
            registry.counter(P + "search.degraded.routes", "mode", tag).increment(degradedRoutes);
        }
    }

    @Override
    public void recordChat(String model, long promptTokens, long completionTokens, long millis) {
        String tag = safe(model);
        Timer.builder(P + "chat")
                .description("z-kb 问答端到端耗时")
                .tag("model", tag)
                .publishPercentiles(0.5, 0.95)
                .register(registry)
                .record(millis, TimeUnit.MILLISECONDS);

        if (promptTokens > 0) {
            registry.counter(P + "chat.tokens", "model", tag, "direction", "prompt").increment(promptTokens);
        }
        if (completionTokens > 0) {
            registry.counter(P + "chat.tokens", "model", tag, "direction", "completion")
                    .increment(completionTokens);
        }
    }

    @Override
    public void recordIngest(int chunks, long millis) {
        registry.counter(P + "ingest.chunks").increment(chunks);
        Timer.builder(P + "ingest")
                .description("z-kb 入库耗时")
                .publishPercentiles(0.5, 0.95)
                .register(registry)
                .record(millis, TimeUnit.MILLISECONDS);
    }

    /** mode / model 来自配置与枚举，标签基数有限；此处只兜住 null */
    private static String safe(String v) {
        return v == null ? "unknown" : v;
    }
}
