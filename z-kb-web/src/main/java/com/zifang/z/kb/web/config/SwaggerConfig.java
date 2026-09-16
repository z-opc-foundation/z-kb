package com.zifang.z.kb.web.config;

import com.github.xiaoymin.knife4j.spring.annotations.EnableKnife4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.builders.PathSelectors;
import springfox.documentation.builders.RequestHandlerSelectors;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.Contact;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;

/**
 * Knife4j / Swagger 配置。
 */
@Configuration
@EnableKnife4j
public class SwaggerConfig {

    @Bean
    public Docket api() {
        return new Docket(DocumentationType.SWAGGER_2)
                .apiInfo(apiInfo())
                .select()
                .apis(RequestHandlerSelectors.basePackage("com.zifang.z.kb.web.controller"))
                .paths(PathSelectors.any())
                .build();
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
                .title("z-kb 知识库 API")
                .description("z-kb — 自研产品级知识库系统（对标 LightRAG + BookStack + RAGFlow + Anything-LLM）")
                .version("1.0.0")
                .contact(new Contact("z-kb 团队", "https://github.com/yuku123", "z-kb@zifang.com"))
                .build();
    }
}
