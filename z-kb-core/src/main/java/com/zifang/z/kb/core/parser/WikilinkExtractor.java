package com.zifang.z.kb.core.parser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Wikilink 抽取器 — Obsidian/Logseq 风格的双向链接 `[[文档名]]` 抽取。
 *
 * <p>支持语法：
 * <ul>
 *   <li>{@code [[文档名]]} — 简单链接</li>
 *   <li>{@code [[文档名|别名]]} — 带别名的链接</li>
 *   <li>{@code [[路径/文档名]]} — 带路径</li>
 * </ul>
 */
public class WikilinkExtractor {

    private static final Logger log = LoggerFactory.getLogger(WikilinkExtractor.class);
    private static final Pattern WIKILINK = Pattern.compile("\\[\\[([^\\]\\n]+?)\\]\\]");

    /**
     * 抽取 wikilink 目标集合（去重）。
     */
    public List<String> extract(String text) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> result = new ArrayList<>();
        if (text == null) return result;
        Matcher m = WIKILINK.matcher(text);
        while (m.find()) {
            String raw = m.group(1).trim();
            // 支持别名 [[目标|别名]]
            int pipe = raw.indexOf('|');
            if (pipe >= 0) raw = raw.substring(0, pipe).trim();
            // 取文件名（去掉路径前缀）
            int slash = raw.lastIndexOf('/');
            if (slash >= 0) raw = raw.substring(slash + 1);
            // 去掉扩展名
            int dot = raw.lastIndexOf('.');
            if (dot > 0 && dot > raw.length() - 6) raw = raw.substring(0, dot);
            raw = raw.trim();
            if (!raw.isEmpty() && seen.add(raw)) {
                result.add(raw);
            }
        }
        return result;
    }

    /** 抽取并保留每个链接的位置信息 */
    public List<WikilinkOccurrence> extractWithPosition(String text) {
        List<WikilinkOccurrence> result = new ArrayList<>();
        if (text == null) return result;
        Matcher m = WIKILINK.matcher(text);
        while (m.find()) {
            String raw = m.group(1).trim();
            int pipe = raw.indexOf('|');
            String target = pipe >= 0 ? raw.substring(0, pipe).trim() : raw;
            String alias = pipe >= 0 ? raw.substring(pipe + 1).trim() : null;
            int slash = target.lastIndexOf('/');
            if (slash >= 0) target = target.substring(slash + 1);
            int dot = target.lastIndexOf('.');
            if (dot > 0 && dot > target.length() - 6) target = target.substring(0, dot);
            result.add(new WikilinkOccurrence(target, alias, m.start(), m.end()));
        }
        return result;
    }

    public static class WikilinkOccurrence {
        public final String target;
        public final String alias;
        public final int start;
        public final int end;

        public WikilinkOccurrence(String target, String alias, int start, int end) {
            this.target = target;
            this.alias = alias;
            this.start = start;
            this.end = end;
        }
    }
}
