package com.zifang.z.kb.api;

/**
 * z-kb 顶层异常。
 */
public class KBException extends RuntimeException {

    public KBException(String message) {
        super(message);
    }

    public KBException(String message, Throwable cause) {
        super(message, cause);
    }

    public KBException(Throwable cause) {
        super(cause);
    }

    /** 不存在异常 */
    public static KBException notFound(String entityType, String id) {
        return new KBException(entityType + " not found: " + id);
    }

    /** 已存在异常 */
    public static KBException alreadyExists(String entityType, String key) {
        return new KBException(entityType + " already exists: " + key);
    }

    /** 参数错误 */
    public static KBException badRequest(String message) {
        return new KBException("Bad request: " + message);
    }
}
