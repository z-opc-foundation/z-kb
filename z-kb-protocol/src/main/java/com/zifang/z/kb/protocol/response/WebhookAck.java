package com.zifang.z.kb.protocol.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Webhook 受理回执 —— {@code POST /api/kb/ingest/webhook}。
 *
 * <p>受理不等于入库：webhook 只进缓冲区，真正入库要等 {@code /webhook/flush}
 * 或流水线自动触发。所以 {@code pending} 是必读字段。
 */
@Schema(description = "Webhook 受理回执")
public class WebhookAck {

    @Schema(description = "是否通过签名校验并受理")
    private boolean accepted;

    @Schema(description = "缓冲区中待入库的条数")
    private int pending;

    public WebhookAck() {}

    public WebhookAck(boolean accepted, int pending) {
        this.accepted = accepted;
        this.pending = pending;
    }

    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public int getPending() { return pending; }
    public void setPending(int pending) { this.pending = pending; }
}
