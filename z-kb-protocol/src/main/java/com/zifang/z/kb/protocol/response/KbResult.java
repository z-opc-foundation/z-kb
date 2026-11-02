package com.zifang.z.kb.protocol.response;

import java.util.Collections;

/**
 * 资源域 REST 统一响应信封（对齐参考实现 {@code {success, code, message, data}}）。
 *
 * <p>前端判定：{@code success === true} 或 {@code code} 为 0/200 即成功，且对象里必须存在
 * {@code data} 键（失败时放空 Map，避免全局 NON_NULL 配置抹掉该键）。</p>
 */
public final class KbResult<T> {

    public static final int SUCCESS_CODE = 0;
    public static final String OK_MESSAGE = "ok";

    private boolean success;
    private int code;
    private String message;
    private T data;

    public KbResult() {
    }

    private KbResult(boolean success, int code, String message, T data) {
        this.success = success;
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> KbResult<T> ok(T data) {
        return new KbResult<>(true, SUCCESS_CODE, OK_MESSAGE, data);
    }

    @SuppressWarnings("unchecked")
    public static <T> KbResult<T> fail(int code, String message) {
        return new KbResult<>(false, code, message, (T) Collections.emptyMap());
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
