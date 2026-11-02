package com.zifang.z.kb.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * z-kb 启动器 — Spring Boot 入口，默认端口 8889。
 *
 * <p><b>为什么不能扫 {@code com.zifang.z.kb} 全包</b>（2026-11-01 实测，standalone 起不来）：
 * <ul>
 *   <li><b>① 条件装配语义被破坏</b>：{@code @ComponentScan} 会把
 *       {@code z-kb-resource} 的 {@code KbResourceAutoConfiguration}、
 *       {@code z-kb-storage} 的 {@code KbResourcePersistenceAutoConfiguration} 当成普通
 *       {@code @Configuration} 注册 —— 而它们是<b>自动配置</b>，类级
 *       {@code @ConditionalOnBean(DataSource.class)} 在<b>扫描解析期</b>求值，此时
 *       {@code DataSourceAutoConfiguration} 还没跑 ⇒ 条件恒 false ⇒
 *       {@code AuditLogService} 等资源域 bean 一个都不注册；
 *       随后 {@code z-kb-web} 的 v1 控制器（{@code @RestController}）被直接扫进来，
 *       绕过了本该保护它们的 {@code KbResourceApiAutoConfiguration} 方法级
 *       {@code @ConditionalOnBean} ⇒ 启动即
 *       {@code required a bean of type 'AuditLogService' that could not be found}。</li>
 *   <li><b>② bean 名冲突</b>：{@code web.api.v1.GraphController}（{@code /api/kb/v1/graph}）与
 *       {@code web.controller.GraphController}（{@code /api/kb/graph}）同名，
 *       全包扫描时两个都进容器 ⇒ {@code ConflictingBeanDefinitionException}。</li>
 * </ul>
 *
 * <p><b>现在的口径</b>：只开自动装配（各模块的 {@code AutoConfiguration.imports} 自行注册，
 * 条件装配语义完整），再<b>精准补扫</b>必须靠扫描才活的那两个包：
 * <ul>
 *   <li>{@code com.zifang.z.kb.web.config} — {@code SwaggerConfig}（springdoc 文档面，
 *       {@code KbWebAutoConfiguration} 只扫 {@code web.controller}，扫不到这里）；</li>
 *   <li>{@code com.zifang.z.kb.web.controller} — 旧版 {@code /api/kb/*} 控制器。</li>
 * </ul>
 * v1 控制器（{@code web.api.v1}）**刻意不扫** —— 它们全部由
 * {@code KbResourceApiAutoConfiguration} 按 {@code @ConditionalOnBean} 逐个注册，
 * 宿主没有 DataSource 时整块不生效，这正是设计意图。
 */
@SpringBootApplication
@ComponentScan(basePackages = {
        "com.zifang.z.kb.web.config",
        "com.zifang.z.kb.web.controller"
})
public class KbBootstrapApplication {

    public static void main(String[] args) {
        System.setProperty("spring.devtools.restart.enabled", "false");
        SpringApplication.run(KbBootstrapApplication.class, args);
    }
}
