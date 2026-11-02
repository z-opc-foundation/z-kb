package com.zifang.z.kb.core.source;

import com.zifang.util.json.JsonUtil;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 同步写入物料 metadata 的来源侧信息：用 docSlug 定位同一篇文档，
 * 用 contentUpdatedAt 判断正文是否变化。
 */
public final class IngestMetadata {

    private IngestMetadata() {
    }

    public static String write(String provider, String namespace, String docSlug, String docId,
            String path, int level, String contentUpdatedAt) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("provider", provider);
        node.put("namespace", namespace);
        node.put("docSlug", docSlug);
        node.put("docId", docId);
        node.put("path", path);
        node.put("level", level);
        node.put("contentUpdatedAt", contentUpdatedAt);
        return JsonUtil.toJson(node);
    }

    /** 读一个字符串字段，缺失、损坏或空白返回 null。 */
    public static String field(String json, String field) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            Map<String, Object> node = JsonUtil.parseToMap(json);
            Object value = node == null ? null : node.get(field);
            if (value == null) {
                return null;
            }
            String text = String.valueOf(value).trim();
            return text.isEmpty() ? null : text;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
