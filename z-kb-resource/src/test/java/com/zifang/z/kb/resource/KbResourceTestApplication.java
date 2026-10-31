package com.zifang.z.kb.resource;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * 资源域集成测试的最小启动类：只开自动装配，不做组件扫描。
 *
 * <p>被测的三个服务与 Mapper 全部由 {@code KbResourcePersistenceAutoConfiguration}
 * 和 {@code KbResourceAutoConfiguration} 装配，这里刻意不额外声明任何 Bean。</p>
 */
@SpringBootConfiguration
@EnableAutoConfiguration
public class KbResourceTestApplication {
}
