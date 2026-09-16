package com.zifang.z.kb.ingest.source;

import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;

import java.util.*;

/**
 * Webhook 数据源 — 不主动抓取，而是把外部 webhook 收到的 payload 转成 IngestRequest。
 *
 * <p>Webhook 控制器（{@code IngestWebhookController}）在收到 POST 时调用
 * {@link #accept(String, String, String, String, java.util.Map)} 入队到内存缓冲，
 * 然后 {@link #fetch(Map)} 从缓冲里读出来。
 *
 * <p>支持 HMAC 校验（X-Signature 头）。
 */
public class WebhookSource implements DataSource {

    private final String sourceId;
    private final List<IngestRequest> buffer = Collections.synchronizedList(new ArrayList<>());

    public WebhookSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public WebhookSource() {
        this("webhook-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.WEBHOOK; }

    /**
     * 接收外部 webhook payload，把每条记录转成 IngestRequest 入队。
     *
     * @param signatureHeader X-Signature 头（可选）
     * @param secret          共享密钥
     * @param title           标题
     * @param content         Markdown 内容
     * @param metadata        额外元数据
     */
    public synchronized boolean accept(String signatureHeader, String secret,
                                        String title, String content, Map<String, Object> metadata) {
        if (secret != null && !secret.isEmpty()) {
            if (signatureHeader == null) return false;
            String expected = hmac(secret, content == null ? "" : content);
            if (!expected.equals(signatureHeader)) return false;
        }
        if (content == null || content.isEmpty()) return false;

        Map<String, Object> meta = metadata != null ? new LinkedHashMap<>(metadata) : new LinkedHashMap<>();
        meta.put("source", "webhook");
        meta.put("receivedAt", System.currentTimeMillis());

        IngestRequest req = IngestRequest.builder()
                .id("webhook:" + UUID.randomUUID().toString())
                .sourceType(DataSourceType.WEBHOOK)
                .sourceId(sourceId)
                .content(content)
                .contentType("text/markdown")
                .workspace((String) meta.getOrDefault("workspace", "default"))
                .title(title == null ? "Webhook 文档" : title)
                .category("webhook")
                .metadata(meta)
                .build();
        buffer.add(req);
        return true;
    }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) {
        synchronized (buffer) {
            if (buffer.isEmpty()) return Collections.emptyList();
            List<IngestRequest> out = new ArrayList<>(buffer);
            buffer.clear();
            return out;
        }
    }

    public int pending() { return buffer.size(); }

    private static String hmac(String secret, String data) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(), "HmacSHA256"));
            byte[] sig = mac.doFinal(data.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : sig) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}