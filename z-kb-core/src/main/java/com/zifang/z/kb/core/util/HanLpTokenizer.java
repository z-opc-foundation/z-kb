package com.zifang.z.kb.core.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 轻量级分词器 — 中英文混合分词，无外部依赖。
 *
 * <p>策略：
 * <ul>
 *   <li>中文字符：按 N-gram（2-gram）切分（粗粒度，但对召回够用）</li>
 *   <li>英文/数字：按非 word 字符切分</li>
 *   <li>驼峰拆分：InfluxDB → [influx, db]</li>
 *   <li>过滤停用词、单字符</li>
 * </ul>
 *
 * <p>生产可替换为 IK Analyzer / HanLP / Jieba。
 */
public final class HanLpTokenizer {

    private HanLpTokenizer() {}

    private static final Pattern TOKEN_PATTERN = Pattern.compile(
            "[\\u4e00-\\u9fff]+|[A-Za-z][A-Za-z0-9]*|[0-9]+");

    private static final List<String> STOP_WORDS = Arrays.asList(
            "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
            "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
            "自己", "这", "那", "么", "把", "它", "他", "她", "我们", "你们", "他们",
            "this", "is", "the", "a", "an", "and", "or", "but", "of", "to", "in", "on",
            "at", "by", "for", "with", "as", "from", "be", "been", "are", "was", "were"
    );

    /**
     * 分词：返回小写化后的词项列表。
     */
    public static List<String> tokenize(String text) {
        if (text == null || text.isEmpty()) return new ArrayList<>();
        List<String> result = new ArrayList<>();
        Matcher m = TOKEN_PATTERN.matcher(text);
        while (m.find()) {
            String token = m.group();
            // 中文：2-gram
            if (token.length() > 1 && isAllChinese(token)) {
                if (token.length() == 2) {
                    addToken(result, token);
                } else {
                    // 滑动窗口 2-gram
                    for (int i = 0; i < token.length() - 1; i++) {
                        addToken(result, token.substring(i, i + 2));
                    }
                    // 加上原词（短词）
                    if (token.length() <= 4) addToken(result, token);
                }
            } else if (token.length() >= 2) {
                // 英文：驼峰拆分
                List<String> parts = splitCamelCase(token);
                for (String p : parts) {
                    addToken(result, p.toLowerCase(Locale.ROOT));
                }
            }
        }
        return result;
    }

    private static void addToken(List<String> result, String token) {
        if (token == null || token.isEmpty()) return;
        String lower = token.toLowerCase(Locale.ROOT);
        if (STOP_WORDS.contains(lower)) return;
        if (lower.length() < 2 && !isChinese(lower.charAt(0))) return;
        result.add(lower);
    }

    private static boolean isAllChinese(String s) {
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            if (cp < 0x4E00 || cp > 0x9FFF) return false;
            i += Character.charCount(cp);
        }
        return true;
    }

    private static boolean isChinese(char c) {
        return c >= 0x4E00 && c <= 0x9FFF;
    }

    /** 驼峰拆分：InfluxDB → [Influx, DB]; userId → [user, Id] */
    private static List<String> splitCamelCase(String s) {
        List<String> parts = new ArrayList<>();
        if (s.isEmpty()) return parts;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (i > 0 && Character.isUpperCase(c) && current.length() > 0) {
                // 上一段结束
                parts.add(current.toString());
                current.setLength(0);
            }
            current.append(c);
        }
        if (current.length() > 0) parts.add(current.toString());
        return parts;
    }
}
