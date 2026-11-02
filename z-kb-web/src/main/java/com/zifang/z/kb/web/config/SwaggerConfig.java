package com.zifang.z.kb.web.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * z-kb 文档面配置 —— springdoc 形态（2026-10-30 从 springfox {@code Docket} 迁来）。
 *
 * <p><b>为什么必须换</b>：springfox 2.10.5 的类里引用 {@code javax/servlet}
 * （{@code springfox-spring-webmvc} 实测 7 处），而 SB3 容器只有 jakarta ——
 * 老配置一旦被组件扫描命中就是 {@code NoClassDefFoundError}。z-kb-bootstrap 的
 * {@code @ComponentScan("com.zifang.z.kb")} 正好会扫到本包，所以这不是"要不要升级"，
 * 而是"扫到即炸"。
 *
 * <p><b>本类只对 standalone 生效</b>：{@code KbWebAutoConfiguration} 的扫描范围刻意只到
 * {@code web.controller}（见该类的 javadoc），宿主（z-opc）不会注册这里的 bean；
 * 两个 {@code @ConditionalOnMissingBean} 是第二道闸 —— 万一宿主也扫到了本包，
 * 宿主的 OpenAPI 定义优先，不会被 z-kb 的标题覆盖。
 */
@Configuration
@ConditionalOnClass(GroupedOpenApi.class)
public class SwaggerConfig {

    /**
     * 顶层 OpenAPI 元信息。宿主已有 {@link OpenAPI} bean 时让位（{@code @ConditionalOnMissingBean}
     * 按类型判，宿主的 title/version 才是对外口径）。
     */
    @Bean
    @ConditionalOnMissingBean(OpenAPI.class)
    public OpenAPI kbOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("z-kb 知识库 API")
                .description("z-kb — 自研产品级知识库系统（对标 LightRAG + BookStack + RAGFlow + Anything-LLM）")
                .version("1.1.0")
                .contact(new Contact().name("z-kb 团队")
                        .url("https://github.com/yuku123")
                        .email("z-kb@zifang.com")));
    }

    /**
     * 按老 {@code Docket} 的 basePackage 口径圈一组 API。分组名沿用 {@code z-kb}，
     * Knife4j UI 上能看到一个独立分组；分组是叠加语义，与宿主的分组不冲突。
     */
    @Bean
    public GroupedOpenApi kbApiGroup() {
        return GroupedOpenApi.builder()
                .group("z-kb")
                .packagesToScan("com.zifang.z.kb.web.controller")
                .build();
    }
}
