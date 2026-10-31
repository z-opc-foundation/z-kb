package com.zifang.z.***REMOVED***.web.api.v1.dto;

import java.util.List;

/**
 * 活跃度（热力图）请求。
 */
public class KnowledgeBaseActivityRequest {

    private List<String> ***REMOVED***Ids;
    private Integer days;

    public List<String> get***REMOVED***Ids() {
        return ***REMOVED***Ids;
    }

    public void set***REMOVED***Ids(List<String> ***REMOVED***Ids) {
        this.***REMOVED***Ids = ***REMOVED***Ids;
    }

    public Integer getDays() {
        return days;
    }

    public void setDays(Integer days) {
        this.days = days;
    }
}
