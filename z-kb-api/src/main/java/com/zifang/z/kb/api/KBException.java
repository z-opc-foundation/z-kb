package com.zifang.z.***REMOVED***.api;

/**
 * z-***REMOVED*** 顶层异常。带错误码，web 层据此填充统一响应信封。
 */
public class ***REMOVED***Exception extends RuntimeException {

    private final String code;

    public ***REMOVED***Exception(String message) {
        this("***REMOVED***ERROR", message, null);
    }

    public ***REMOVED***Exception(String message, Throwable cause) {
        this("***REMOVED***ERROR", message, cause);
    }

    public ***REMOVED***Exception(Throwable cause) {
        this("***REMOVED***ERROR", cause == null ? null : cause.getMessage(), cause);
    }

    public ***REMOVED***Exception(String code, String message) {
        this(code, message, null);
    }

    public ***REMOVED***Exception(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    /** 不存在异常 */
    public static ***REMOVED***Exception notFound(String entityType, String id) {
        return new ***REMOVED***Exception("***REMOVED***NOT_FOUND", entityType + " not found: " + id);
    }

    /** 已存在异常 */
    public static ***REMOVED***Exception alreadyExists(String entityType, String key) {
        return new ***REMOVED***Exception("***REMOVED***ALREADY_EXISTS", entityType + " already exists: " + key);
    }

    /** 参数错误 */
    public static ***REMOVED***Exception badRequest(String message) {
        return new ***REMOVED***Exception("***REMOVED***BAD_REQUEST", "Bad request: " + message);
    }

    /** 无权限 */
    public static ***REMOVED***Exception forbidden(String message) {
        return new ***REMOVED***Exception("***REMOVED***FORBIDDEN", message);
    }

    /** 状态/唯一性冲突 */
    public static ***REMOVED***Exception conflict(String message) {
        return new ***REMOVED***Exception("***REMOVED***CONFLICT", message);
    }
}
