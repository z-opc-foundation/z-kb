package com.zifang.z.kb.resource;

import com.zifang.z.kb.core.extraction.CognitionGateway;
import com.zifang.z.kb.resource.ops.RemoteCognitionGateway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

import java.time.Duration;

/**
 * 认知域网关装配（TASK-20261101-006）。
 *
 * <p><b>为什么必须独立成类</b>：{@code z-cognition-client} 在 {@code z-kb-resource} 里是
 * {@code optional} 依赖 —— 它只在本模块自己的 classpath 上，消费方（如 {@code z-kb-web}）
 * 的 classpath 上没有。如果网关 bean 写在 {@link KbResourceAutoConfiguration} 里，
 * 哪怕方法上挂了 {@code @ConditionalOnClass}，Spring 也要先加载宿主类、
 * 解析方法参数类型 {@code CognitionClient}，才会谈条件判定 ⇒ 运行时
 * {@code NoClassDefFoundError: com/zifang/z/cognition/client/CognitionClient}。
 * {@code @ConditionalOnClass} 拦不住「类加载期」的类型解析。</p>
 *
 * <p><b>正确姿势</b>：把条件放到<b>类级别</b>。Spring Boot 处理
 * {@code @AutoConfiguration} 时会先读类上的 {@code @ConditionalOnClass}，判定不满足就
 * 整体跳过这个配置类，宿主类根本不会被加载 ⇒ 缺 jar 时干净降级，行为与接入前一致。</p>
 *
 * <p>三个守卫缺一不可：① 类级 {@code @ConditionalOnClass} —— 缺 client jar 即整体不装配；
 * ② {@code @ConditionalOnProperty} —— {@code kb.cognition.base-url} 留空即关闭；
 * ③ {@code @ConditionalOnMissingBean} —— 允许业务方覆盖网关实现。</p>
 */
@AutoConfiguration(before = KbResourceAutoConfiguration.class)
@ConditionalOnClass(name = {
        "com.zifang.z.cognition.client.CognitionClientFactory",
        "com.zifang.z.cognition.client.RemoteCognitionClient"
})
@ConditionalOnProperty(name = "kb.cognition.base-url")
public class KbCognitionAutoConfiguration {

    /**
     * 认知域网关：连 z-cognition 做术语消歧与新词提议。
     *
     * <p>降级语义在实现侧（{@code RemoteCognitionGateway}）：认知域不可达时返回空结果，
     * 绝不把异常抛给编译管线。</p>
     */
    @Bean
    @ConditionalOnMissingBean
    public CognitionGateway cognitionGateway(
            @Value("${kb.cognition.base-url:}") String baseUrl,
            @Value("${kb.cognition.token:}") String token,
            @Value("${kb.cognition.timeout-millis:2000}") int timeoutMillis) {
        return new RemoteCognitionGateway(
                new com.zifang.z.cognition.client.RemoteCognitionClient(baseUrl,
                        Duration.ofMillis(Math.max(1, timeoutMillis))),
                token);
    }
}
