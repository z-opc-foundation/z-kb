package com.zifang.z.***REMOVED***.web.caller;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 默认实现：从网关/边缘注入的请求头取租户与操作人。
 *
 * <p>请求头：{@code X-Tenant-Code}、{@code X-Actor-Id}、{@code X-Actor-Name}。
 * 本地直连（无网关注入）时回落为 {@code default / anonymous}，保证开发态可跑。</p>
 */
public class Header***REMOVED***CallerResolver implements ***REMOVED***CallerResolver {

    public static final String TENANT_HEADER = "X-Tenant-Code";
    public static final String ACTOR_ID_HEADER = "X-Actor-Id";
    public static final String ACTOR_NAME_HEADER = "X-Actor-Name";
    public static final String DEFAULT_TENANT = "default";
    public static final String DEFAULT_ACTOR_ID = "anonymous";

    @Override
    public ***REMOVED***Caller resolve(HttpServletRequest request) {
        String tenant = value(request, TENANT_HEADER, DEFAULT_TENANT);
        String actorId = value(request, ACTOR_ID_HEADER, DEFAULT_ACTOR_ID);
        String actorName = value(request, ACTOR_NAME_HEADER, null);
        return new ***REMOVED***Caller(tenant, actorId, actorName);
    }

    private static String value(HttpServletRequest request, String header, String fallback) {
        if (request == null) {
            return fallback;
        }
        String value = request.getHeader(header);
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        return value.trim();
    }
}
