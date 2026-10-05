package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 计数响应 —— {@code GET /api/kb/documents/{workspace}/count}。
 */
@ApiModel(description = "计数响应")
public class CountResponse {

    @ApiModelProperty(value = "条目数")
    private long count;

    public CountResponse() {}

    public CountResponse(long count) { this.count = count; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }
}
