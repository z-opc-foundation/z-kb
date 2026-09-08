package com.zifang.z.kb.core.parser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Frontmatter 解析器 — 兼容 yuque、obsidian、jekyll 三种常见 YAML 简化语法。
 *
 * <p>采用轻量自研 YAML 解析，**不依赖 SnakeYAML**。
 */
public class FrontmatterParser {

    private static final Logger log = LoggerFactory.getLogger(FrontmatterParser.class);
    private static final Pattern FENCE_PATTERN = Pattern.compile("^---\\s*\\n(.*?)\\n---\\s*\\n?(.*)$", Pattern.DOTALL);

    /** 解析结果 */
    public static class ParseResult {
        public final Map<String, Object> frontmatter;
        public final String body;

        public ParseResult(Map<String, Object> frontmatter, String body) {
            this.frontmatter = frontmatter;
            this.body = body;
        }
    }

    /**
     * 解析 frontmatter + 正文。
     */
    public ParseResult parse(String markdown) {
        if (markdown == null || markdown.isEmpty()) {
            return new ParseResult(new LinkedHashMap<>(), "");
        }
        Matcher m = FENCE_PATTERN.matcher(markdown);
        if (!m.find()) {
            return new ParseResult(new LinkedHashMap<>(), markdown);
        }
        String fmText = m.group(1);
        String body = m.group(2);
        Map<String, Object> fm = parseYamlLite(fmText);
        return new ParseResult(fm, body);
    }

    /** 轻量级 YAML 解析 */
    private Map<String, Object> parseYamlLite(String text) {
        Map<String, Object> root = new LinkedHashMap<>();
        Deque<Map<String, Object>> stack = new ArrayDeque<>();
        stack.push(root);

        String[] lines = text.split("\\n");
        for (String rawLine : lines) {
            if (rawLine.trim().isEmpty() || rawLine.trim().startsWith("#")) continue;

            int indent = 0;
            while (indent < rawLine.length() && rawLine.charAt(indent) == ' ') indent++;
            String content = rawLine.substring(indent);

            if (content.startsWith("- ")) {
                // 列表项 - 跳过（已展开为 [] 在 key: 后面）
                continue;
            }

            int colonIdx = content.indexOf(':');
            if (colonIdx < 0) continue;

            String key = content.substring(0, colonIdx).trim();
            String valuePart = content.substring(colonIdx + 1).trim();

            // 弹栈到正确层级
            int depth = (indent / 2) + 1;
            while (stack.size() > depth) {
                stack.pop();
            }
            Map<String, Object> target = stack.peek();

            if (valuePart.isEmpty()) {
                Map<String, Object> nested = new LinkedHashMap<>();
                target.put(key, nested);
                stack.push(nested);
            } else if (valuePart.startsWith("[") && valuePart.endsWith("]")) {
                List<Object> arr = new ArrayList<>();
                for (String s : valuePart.substring(1, valuePart.length() - 1).split(",")) {
                    arr.add(unquote(s.trim()));
                }
                target.put(key, arr);
            } else {
                target.put(key, unquote(valuePart));
            }
        }
        return root;
    }

    private String unquote(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
            return s.substring(1, s.length() - 1);
        }
        if (s.length() >= 2 && s.startsWith("'") && s.endsWith("'")) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }
}
