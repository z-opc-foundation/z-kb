package com.zifang.z.kb.protocol.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 计数响应 —— {@code GET /api/kb/documents/{workspace}/count}。
 */
@Schema(description = "计数响应")
public class CountResponse {

    @Schema(description = "条目数")
    private long count;

    public CountResponse() {}

    public CountResponse(long count) { this.count = count; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }
}
