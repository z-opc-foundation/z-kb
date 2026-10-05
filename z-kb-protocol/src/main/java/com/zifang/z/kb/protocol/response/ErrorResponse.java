package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 统一错误信封 —— 由 {@code WebExceptionHandler} 产出。
 *
 * <p>三个字段在所有错误响应里都出现，前端可以无差别解构。
 */
@ApiModel(description = "统一错误响应")
public class ErrorResponse {

    @ApiModelProperty(value = "固定为 error", example = "error")
    private String status = "error";

    @ApiModelProperty(value = "HTTP 语义错误码", example = "400")
    private int code;

    @ApiModelProperty(value = "错误详情")
    private String message;

    public ErrorResponse() {}

    public ErrorResponse(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getCode() { return code; }
    public void setCode(int code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
