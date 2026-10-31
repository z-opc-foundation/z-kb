package com.zifang.z.***REMOVED***.web.autoconfigure;

import com.zifang.z.***REMOVED***.resource.***REMOVED***ResourceAutoConfiguration;
import com.zifang.z.***REMOVED***.web.caller.Header***REMOVED***CallerResolver;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
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
 * z-***REMOVED***-web 自动装配 — 让既有 {@code /api/***REMOVED***/*} 控制器随 jar 生效。
 *
 * <p>既有 7 个 controller（{@code com.zifang.z.***REMOVED***.web.controller}）无条件扫描；
 * 资源域 v1 控制器由 {@link ***REMOVED***ResourceApiAutoConfiguration} 单独装配 ——
 * 它依赖 {@code KnowledgeBaseResourceService}，宿主没有 DataSource 时整块不装配。</p>
 *
 * <p><b>异常处理</b>：{@link WebExceptionHandler} 是唯一的全局 advice，内部按控制器包
 * 区分 v1 信封与既有 ErrorResponse 形状；宿主已有自己的全局 advice 时不重复注册。</p>
 */
@AutoConfiguration(after = ***REMOVED***ResourceAutoConfiguration.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ComponentScan(basePackages = "com.zifang.z.***REMOVED***.web.controller")
public class ***REMOVED***WebAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(***REMOVED***WebAutoConfiguration.class);

    /**
     * z-***REMOVED*** 自己的全局异常处理 —— 只在「容器里一个 {@code @ControllerAdvice} 都没有」时注册。
     */
    @Bean
    @ConditionalOnMissingBean(annotation = ControllerAdvice.class)
    public WebExceptionHandler webExceptionHandler() {
        log.info("z-***REMOVED*** web 装配生效：/api/***REMOVED***/* controller 已注册；容器内无其它全局 advice，"
                + "z-***REMOVED*** 自带异常处理");
        return new WebExceptionHandler();
    }

    /**
     * 调用者解析：默认读请求头，宿主可注册同名 Bean 覆盖（例如改用 z-ctc TenantContext）。
     */
    @Bean
    @ConditionalOnMissingBean
    public ***REMOVED***CallerResolver ***REMOVED***CallerResolver() {
        return new Header***REMOVED***CallerResolver();
    }
}
