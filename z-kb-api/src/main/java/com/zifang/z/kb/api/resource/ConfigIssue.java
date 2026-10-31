package com.zifang.z.kb.api.resource;

/**
 * 配置校验项（对齐参考实现 ConfigValidationInfo.Item）。
 */
public class ConfigIssue {

    private String code;
    private String label;
    private boolean ok;
    private String message;

    public ConfigIssue() {
    }

    public ConfigIssue(String code, String label, boolean ok, String message) {
        this.code = code;
        this.label = label;
        this.ok = ok;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
