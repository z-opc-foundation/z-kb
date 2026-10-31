package com.zifang.z.***REMOVED***.api.evaluation;

/**
 * 数据集发布参数：带期望版本号做乐观校验。
 */
public class EvalDatasetPublishParam {

    private String ***REMOVED***Id;
    private Integer expectedVersionNo;

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public Integer getExpectedVersionNo() {
        return expectedVersionNo;
    }

    public void setExpectedVersionNo(Integer expectedVersionNo) {
        this.expectedVersionNo = expectedVersionNo;
    }
}
