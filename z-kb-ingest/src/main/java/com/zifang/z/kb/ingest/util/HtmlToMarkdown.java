package com.zifang.z.kb.ingest.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 极简 HTML → Markdown 转换器 — 处理常见的标签（h1-h6, p, ul, ol, li, code, pre, blockquote, img, a, b/strong, i/em），
 * 保持简单可预测，避免引入 jsoup 等依赖。
 *
 * <p>适用于 URL 抓取、Confluence、Notion 等输出 HTML 的数据源。
 */
public final class HtmlToMarkdown {

    private HtmlToMarkdown() {}

    private static final Pattern SCRIPT_STYLE = Pattern.compile(
            "<(script|style)[^>]*>.*?</\\1>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern TAG = Pattern.compile("<[^>]+>", Pattern.DOTALL);
    private static final Pattern MULTI_BLANK = Pattern.compile("\\n{3,}");
    private static final Pattern HTML_ENTITIES = Pattern.compile("&(amp|lt|gt|quot|apos|#\\d+);");

    public static String convert(String html) {
        if (html == null || html.isEmpty()) return "";
        String s = html;

        // 去除 script/style
        s = SCRIPT_STYLE.matcher(s).replaceAll("");

        // 块级元素转换
        s = s.replaceAll("(?is)<h1[^>]*>(.*?)</h1>", "\n# $1\n");
        s = s.replaceAll("(?is)<h2[^>]*>(.*?)</h2>", "\n## $1\n");
        s = s.replaceAll("(?is)<h3[^>]*>(.*?)</h3>", "\n### $1\n");
        s = s.replaceAll("(?is)<h4[^>]*>(.*?)</h4>", "\n#### $1\n");
        s = s.replaceAll("(?is)<h5[^>]*>(.*?)</h5>", "\n##### $1\n");
        s = s.replaceAll("(?is)<h6[^>]*>(.*?)</h6>", "\n###### $1\n");

        s = s.replaceAll("(?is)<p[^>]*>(.*?)</p>", "\n$1\n");
        s = s.replaceAll("(?is)<br\\s*/?>", "\n");
        s = s.replaceAll("(?is)<hr\\s*/?>", "\n---\n");

        // 列表
        s = s.replaceAll("(?is)<ul[^>]*>(.*?)</ul>", "\n$1\n");
        s = s.replaceAll("(?is)<ol[^>]*>(.*?)</ol>", "\n$1\n");
        s = s.replaceAll("(?is)<li[^>]*>(.*?)</li>", "- $1\n");

        // 行内
        s = s.replaceAll("(?is)<strong[^>]*>(.*?)</strong>", "**$1**");
        s = s.replaceAll("(?is)<b[^>]*>(.*?)</b>", "**$1**");
        s = s.replaceAll("(?is)<em[^>]*>(.*?)</em>", "*$1*");
        s = s.replaceAll("(?is)<i[^>]*>(.*?)</i>", "*$1*");
        s = s.replaceAll("(?is)<del[^>]*>(.*?)</del>", "~~$1~~");
        s = s.replaceAll("(?is)<code[^>]*>(.*?)</code>", "`$1`");
        s = s.replaceAll("(?is)<pre[^>]*>(.*?)</pre>", "\n```\n$1\n```\n");
        s = s.replaceAll("(?is)<blockquote[^>]*>(.*?)</blockquote>", "\n> $1\n");

        // 图片和链接
        s = s.replaceAll("(?is)<img[^>]*src=[\"']([^\"']+)[\"'][^>]*alt=[\"']([^\"']*)[\"'][^>]*/?>",
                "![$2]($1)");
        s = s.replaceAll("(?is)<img[^>]*alt=[\"']([^\"']*)[\"'][^>]*src=[\"']([^\"']+)[\"'][^>]*/?>",
                "![$1]($2)");
        s = s.replaceAll("(?is)<img[^>]*src=[\"']([^\"']+)[\"'][^>]*/?>", "![]($1)");
        s = s.replaceAll("(?is)<a[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", "[$2]($1)");

        // 移除剩余标签
        s = TAG.matcher(s).replaceAll("");

        // HTML 实体
        s = s.replace("&amp;", "&");
        s = s.replace("&lt;", "<");
        s = s.replace("&gt;", ">");
        s = s.replace("&quot;", "\"");
        s = s.replace("&apos;", "'");
        s = s.replace("&nbsp;", " ");
        Matcher m = HTML_ENTITIES.matcher(s);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String token = m.group(1);
            if (token.startsWith("#")) {
                try {
                    int code = Integer.parseInt(token.substring(1));
                    m.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf((char) code)));
                } catch (Exception e) {
                    m.appendReplacement(sb, Matcher.quoteReplacement(m.group()));
                }
            } else {
                m.appendReplacement(sb, Matcher.quoteReplacement(m.group()));
            }
        }
        m.appendTail(sb);
        s = sb.toString();

        // 折叠空行
        s = MULTI_BLANK.matcher(s).replaceAll("\n\n");
        return s.trim();
    }
}