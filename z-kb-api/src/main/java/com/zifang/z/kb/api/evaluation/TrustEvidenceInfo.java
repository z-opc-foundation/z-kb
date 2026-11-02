package com.zifang.z.kb.api.evaluation;

/**
 * 可信证据：版本、覆盖、评分、逐题、复现。
 */
public class TrustEvidenceInfo {

    private String code;
    private String label;
    private String status;
    private String detail;

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }
}
