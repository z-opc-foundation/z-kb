package com.zifang.z.kb.core.source.git;

/** Git 托管平台 REST 调用失败。kind 用于区分「可重试」与「确定性错误」。 */
public class GitApiException extends RuntimeException {

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

    public GitApiException(Kind kind, String message) {
        this(kind, null, message, null);
    }

    public GitApiException(Kind kind, String message, Throwable cause) {
        this(kind, null, message, cause);
    }

    public GitApiException(Kind kind, Integer statusCode, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.statusCode = statusCode;
    }

    public Kind getKind() {
        return kind;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public boolean isRetryable() {
        return kind == Kind.NETWORK || kind == Kind.RATE_LIMITED || kind == Kind.SERVER;
    }
}
