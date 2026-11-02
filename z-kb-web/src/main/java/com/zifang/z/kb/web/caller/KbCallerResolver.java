package com.zifang.z.kb.web.caller;

import com.zifang.z.kb.api.resource.KbCaller;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 调用者解析 SPI：宿主接入 z-ctc 后可用 TenantContext 实现替换默认的请求头实现。
 */
public interface KbCallerResolver {

    KbCaller resolve(HttpServletRequest request);
}
