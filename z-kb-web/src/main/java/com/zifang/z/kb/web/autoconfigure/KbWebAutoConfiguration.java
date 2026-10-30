package com.zifang.z.***REMOVED***.web.autoconfigure;

import com.zifang.z.***REMOVED***.web.exception.WebExceptionHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.web.bind.annotation.ControllerAdvice;

/**
 * z-***REMOVED***-web 自动装配 — 让 7 个 {@code @RestController} 随 jar 生效。
 *
 * <p><b>为什么必须有它</b>：z-***REMOVED***-web 的 7 个 controller（Workspace / Document / Search / Chat /
 * Graph / Ingest / Modeling）此前既没有 {@code .imports} 注册，也没有 {@code @ComponentScan} ——
 * 「谁引这个 jar 都不会有 {@code /api/***REMOVED***/*}」。宿主（z-opc）一旦引入本 jar，本类负责把
 * {@code com.zifang.z.***REMOVED***.web.controller} 下的 controller 注册进容器。
 *
 * <p><b>扫描范围只到 controller 包</b>，两个刻意的不扫描项：
 * <ul>
 *   <li>{@code web.config.SwaggerConfig} —— 它带 springdoc 的 {@code GroupedOpenApi}。
 *       宿主（z-opc）自己已装 springdoc 2.6.0 + knife4j-openapi3-jakarta 4.5.0，
 *       再注册一份分组只会两边文档面打架；且本 jar 的 springdoc 依赖是 optional 的，
 *       宿主 classpath 上未必有它 ⇒ 扫它等于给宿主埋一颗类加载炸弹。
 *       需要 z-***REMOVED*** 自己的文档面时，宿主显式 {@code @Import(SwaggerConfig.class)} 即可
 *       （该配置类自带 {@code @ConditionalOnMissingBean(OpenAPI.class)}，不会盖掉宿主的定义）。</li>
 *   <li>{@code web.exception.WebExceptionHandler} —— 它带 {@code @ExceptionHandler(Exception.class)}
 *       兜底，宿主的全局 advice 也在处理同一类异常，两个都注册会让「谁先接住异常」变成装配顺序问题。
 *       所以本类用 {@code @ConditionalOnMissingBean(annotation = ControllerAdvice.class)} 挂它：
 *       宿主已有全局 advice 时不重复注册（宿主那份已登记 {@code ***REMOVED***Exception → 400}），
 *       独立跑 z-***REMOVED*** 时才由本类补上。</li>
 * </ul>
 */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ComponentScan(basePackages = "com.zifang.z.***REMOVED***.web.controller")
public class ***REMOVED***WebAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(***REMOVED***WebAutoConfiguration.class);

    /**
     * z-***REMOVED*** 自己的全局异常处理 —— 只在「容器里一个 {@code @ControllerAdvice} 都没有」时注册。
     *
     * <p>用 {@code ControllerAdvice}（而不是 {@code RestControllerAdvice}）做条件：宿主里两种写法都有，
     * 而 {@code @RestControllerAdvice} 本身是 {@code @ControllerAdvice} 的元注解，
     * 按基类注解找才能把两种写法都算进去。
     */
    @Bean
    @ConditionalOnMissingBean(annotation = ControllerAdvice.class)
    public WebExceptionHandler webExceptionHandler() {
        log.info("z-***REMOVED*** web 装配生效：/api/***REMOVED***/* controller 已注册；容器内无其它全局 advice，"
                + "z-***REMOVED*** 自带异常处理（***REMOVED***Exception → 400）");
        return new WebExceptionHandler();
    }
}
