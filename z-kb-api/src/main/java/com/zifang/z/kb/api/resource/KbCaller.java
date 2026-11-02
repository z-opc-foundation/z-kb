package com.zifang.z.kb.api.resource;

/**
 * 调用者身份：租户 + 操作人。
 *
 * <p>由 web 层从请求上下文（z-ctc SSO / 请求头）解析后显式传给服务，
 * 服务内部不读 ThreadLocal，便于单测与异步任务复用。</p>
 */
public final class KbCaller {

    private final String tenantCode;
    private final String actorId;
    private final String actorName;

    public KbCaller(String tenantCode, String actorId, String actorName) {
        this.tenantCode = tenantCode;
        this.actorId = actorId;
        this.actorName = actorName;
    }

    public static KbCaller of(String tenantCode, String actorId) {
        return new KbCaller(tenantCode, actorId, null);
    }

    public String getTenantCode() {
        return tenantCode;
    }

    public String getActorId() {
        return actorId;
    }

    public String getActorName() {
        return actorName;
    }

    public boolean isSameActor(String principalId) {
        return principalId != null && principalId.equals(actorId);
    }
}
