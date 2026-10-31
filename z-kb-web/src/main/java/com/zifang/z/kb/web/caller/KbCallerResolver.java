package com.zifang.z.***REMOVED***.web.caller;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 调用者解析 SPI：宿主接入 z-ctc 后可用 TenantContext 实现替换默认的请求头实现。
 */
public interface ***REMOVED***CallerResolver {

    ***REMOVED***Caller resolve(HttpServletRequest request);
}
