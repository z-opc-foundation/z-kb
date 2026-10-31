package com.zifang.z.kb.web.api.v1.dto;

import com.zifang.z.kb.api.audit.AuditLogQuery;

/**
 * 审计日志分页查询请求。
 */
public class AuditLogPageRequest {

    private String keyword;
    private String type;
    private String bizRef;
    private String actorId;
    private Integer success;
    private Long startTime;
    private Long endTime;
    private long current = 1;
    private long size = 20;

    public AuditLogQuery toQuery() {
        AuditLogQuery query = new AuditLogQuery();
        query.setKeyword(keyword);
        query.setType(type);
        query.setBizRef(bizRef);
        query.setActorId(actorId);
        query.setSuccess(success);
        query.setStartTime(startTime);
        query.setEndTime(endTime);
        query.setCurrent(current);
        query.setSize(size);
        return query;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getBizRef() {
        return bizRef;
    }

    public void setBizRef(String bizRef) {
        this.bizRef = bizRef;
    }

    public String getActorId() {
        return actorId;
    }

    public void setActorId(String actorId) {
        this.actorId = actorId;
    }

    public Integer getSuccess() {
        return success;
    }

    public void setSuccess(Integer success) {
        this.success = success;
    }

    public Long getStartTime() {
        return startTime;
    }

    public void setStartTime(Long startTime) {
        this.startTime = startTime;
    }

    public Long getEndTime() {
        return endTime;
    }

    public void setEndTime(Long endTime) {
        this.endTime = endTime;
    }

    public long getCurrent() {
        return current;
    }

    public void setCurrent(long current) {
        this.current = current;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }
}
