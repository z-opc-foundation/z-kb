package com.zifang.z.kb.resource;

import com.zifang.util.json.JsonUtil;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 配置策略 JSON 的读写辅助：库内一律存 JSON 对象文本。
 */
final class KbResourceJson {

    private KbResourceJson() {
    }

    /** 解析为 Map；空/非法/非对象时返回空 Map。 */
    @SuppressWarnings("unchecked")
    static Map<String, Object> parseObject(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(json));
            if (plain instanceof Map) {
                return new LinkedHashMap<>((Map<String, Object>) plain);
            }
        } catch (RuntimeException ignored) {
            // 非法 JSON 由校验入口拦截；读取路径按空对象处理，不让历史脏数据打断查询
        }
        return new LinkedHashMap<>();
    }

    static String writeObject(Map<String, Object> map) {
        return JsonUtil.toJson(map == null ? new LinkedHashMap<>() : map);
    }

    /** 是否为合法 JSON 对象。 */
    static boolean isJsonObject(String json) {
        if (json == null || json.trim().isEmpty()) {
            return false;
        }
        try {
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(json));
            return plain instanceof Map;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** 归一化策略文本：去空白，空值统一为 {}。 */
    static String normalize(String json) {
        return json == null || json.trim().isEmpty() ? "{}" : json.trim();
    }
}
