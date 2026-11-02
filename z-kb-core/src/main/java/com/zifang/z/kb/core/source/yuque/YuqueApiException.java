package com.zifang.z.kb.core.source.yuque;

/**
 * 语雀 OpenAPI 调用失败。kind 用于区分「可重试」与「确定性错误」：
 * 网络、限流、5xx 可重试；401/403/404 重试无意义，直接暴露给调用方。
 */
public class YuqueApiException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public enum Kind {
        UNAUTHORIZED,
        NOT_FOUND,
        RATE_LIMITED,
        SERVER,
        NETWORK,
        INVALID_RESPONSE
    }

    private final Kind kind;
    private final Integer statusCode;
    private final Long retryAfterSeconds;

    public YuqueApiException(Kind kind, String message) {
        this(kind, null, message, null, null);
    }

    public YuqueApiException(Kind kind, String message, Throwable cause) {
        this(kind, null, message, null, cause);
    }

    public YuqueApiException(Kind kind, Integer statusCode, String message,
            Long retryAfterSeconds) {
        this(kind, statusCode, message, retryAfterSeconds, null);
    }

    private YuqueApiException(Kind kind, Integer statusCode, String message,
            Long retryAfterSeconds, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.statusCode = statusCode;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public Kind getKind() {
        return kind;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }

    public boolean isRetryable() {
        return kind == Kind.NETWORK || kind == Kind.RATE_LIMITED || kind == Kind.SERVER;
    }
}
