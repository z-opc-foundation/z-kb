package com.zifang.z.kb.api;

/**
 * z-kb 顶层异常。带错误码，web 层据此填充统一响应信封。
 */
public class KBException extends RuntimeException {

    private final String code;

    public KBException(String message) {
        this("KB_ERROR", message, null);
    }

    public KBException(String message, Throwable cause) {
        this("KB_ERROR", message, cause);
    }

    public KBException(Throwable cause) {
        this("KB_ERROR", cause == null ? null : cause.getMessage(), cause);
    }

    public KBException(String code, String message) {
        this(code, message, null);
    }

    public KBException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    /** 不存在异常 */
    public static KBException notFound(String entityType, String id) {
        return new KBException("KB_NOT_FOUND", entityType + " not found: " + id);
    }

    /** 已存在异常 */
    public static KBException alreadyExists(String entityType, String key) {
        return new KBException("KB_ALREADY_EXISTS", entityType + " already exists: " + key);
    }

    /** 参数错误 */
    public static KBException badRequest(String message) {
        return new KBException("KB_BAD_REQUEST", "Bad request: " + message);
    }

    /** 无权限 */
    public static KBException forbidden(String message) {
        return new KBException("KB_FORBIDDEN", message);
    }

    /** 状态/唯一性冲突 */
    public static KBException conflict(String message) {
        return new KBException("KB_CONFLICT", message);
    }
}
