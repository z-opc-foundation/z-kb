package com.zifang.z.kb.api.audit;

/**
 * 审计日志查询条件。时间范围为左闭右闭的毫秒时间戳，为空表示不限。
 */
public class AuditLogQuery {

    /** 关键词，匹配动作编码、操作说明、目标类型与目标标识。 */
    private String keyword;

    /** 日志类型：SYS / KB；为空表示不限。 */
    private String type;

    /** 业务指向键，KB 日志为知识库标识；为空表示不限。 */
    private String bizRef;

    /** 操作人主体 ID。 */
    private String actorId;

    /** 结果筛选：1-成功 0-异常。 */
    private Integer success;

    /** 起始时间（含），毫秒时间戳。 */
    private Long startTime;

    /** 结束时间（含），毫秒时间戳。 */
    private Long endTime;

    private long current = 1;
    private long size = 20;

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
