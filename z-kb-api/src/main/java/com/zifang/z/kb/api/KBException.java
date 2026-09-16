package com.zifang.z.***REMOVED***.api;

/**
 * z-***REMOVED*** 顶层异常。
 */
public class ***REMOVED***Exception extends RuntimeException {

    public ***REMOVED***Exception(String message) {
        super(message);
    }

    public ***REMOVED***Exception(String message, Throwable cause) {
        super(message, cause);
    }

    public ***REMOVED***Exception(Throwable cause) {
        super(cause);
    }

    /** 不存在异常 */
    public static ***REMOVED***Exception notFound(String entityType, String id) {
        return new ***REMOVED***Exception(entityType + " not found: " + id);
    }

    /** 已存在异常 */
    public static ***REMOVED***Exception alreadyExists(String entityType, String key) {
        return new ***REMOVED***Exception(entityType + " already exists: " + key);
    }

    /** 参数错误 */
    public static ***REMOVED***Exception badRequest(String message) {
        return new ***REMOVED***Exception("Bad request: " + message);
    }
}
