package com.zifang.z.kb.starter.config;

import com.zifang.z.kb.api.KbMetrics;
import com.zifang.z.kb.starter.metrics.MicrometerKbMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 埋点必须是无条件可缺省的：容器里有 actuator 就出指标，没有就安静退化成无埋点，
 * 不能反过来成为 z-kb 的接入前提。
 */
class KbMetricsAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(KBAutoConfiguration.MetricsConfiguration.class));

    @Test
    @DisplayName("有 MeterRegistry 时装配出 KbMetrics")
    void metricsPresentWithRegistry() {
        runner.withBean(SimpleMeterRegistry.class, SimpleMeterRegistry::new)
                .run(ctx -> {
                    assertTrue(ctx.containsBean("kbMetrics"), "kbMetrics bean 未装配");
                    assertTrue(ctx.getBean(KbMetrics.class) instanceof MicrometerKbMetrics);
                });
    }

    @Test
    @DisplayName("没有 MeterRegistry 时不产生埋点实现，且上下文照常启动")
    void metricsAbsentWithoutRegistry() {
        runner.run(ctx -> {
            assertNull(ctx.getStartupFailure(), "上下文启动失败");
            // @Bean 返回 null 会注册成一个 NullBean 占位（bean 名在，取出来不是实现）。
            // 断言的是「拿不到可用实现」，而不是「没有这个 bean 名」。
            for (String name : ctx.getBeanNamesForType(KbMetrics.class)) {
                Object bean = ctx.getBean(name);
                assertFalse(bean instanceof MicrometerKbMetrics, "无 registry 却产出了埋点实现: " + name);
            }
        });
    }
}
