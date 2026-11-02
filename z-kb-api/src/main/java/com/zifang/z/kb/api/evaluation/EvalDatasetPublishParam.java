package com.zifang.z.kb.api.evaluation;

/**
 * 数据集发布参数：带期望版本号做乐观校验。
 */
public class EvalDatasetPublishParam {

    private String kbId;
    private Integer expectedVersionNo;

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public Integer getExpectedVersionNo() {
        return expectedVersionNo;
    }

    public void setExpectedVersionNo(Integer expectedVersionNo) {
        this.expectedVersionNo = expectedVersionNo;
    }
}
