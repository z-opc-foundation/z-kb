package com.zifang.z.kb.core.parser;

import com.zifang.z.kb.api.Document;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document.OutputSettings;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Markdown 解析器 — z-kb 主入口。
 *
 * <p>职责：
 * <ul>
 *   <li>剥离/解析 frontmatter</li>
 *   <li>提取标题（一级 / 多级）</li>
 *   <li>抽取 wikilink</li>
 *   <li>渲染 HTML（用于前端预览）</li>
 *   <li>纯文本化（用于 Embedding 与摘要）</li>
 * </ul>
 */
public class MarkdownParser {

    private static final Logger log = LoggerFactory.getLogger(MarkdownParser.class);

    private final FrontmatterParser frontmatterParser = new FrontmatterParser();
    private final WikilinkExtractor wikilinkExtractor = new WikilinkExtractor();

    private static final Pattern H1_PATTERN = Pattern.compile("^#\\s+(.+)$", Pattern.MULTILINE);
    private static final Pattern HEADING_PATTERN =
            Pattern.compile("^(#{1,6})\\s+(.+?)\\s*$", Pattern.MULTILINE);
    private static final Pattern LINK_REFERENCE_PATTERN =
            Pattern.compile("\\[([^\\]]+)\\]\\(([^)]+)\\)");
    private static final Pattern CODE_BLOCK_PATTERN =
            Pattern.compile("```[\\s\\S]*?```");

    /** 解析结果（更全面的解析） */
    public static class ParseResult {
        public String title;
        public String body;
        public Map<String, Object> frontmatter = new LinkedHashMap<>();
        public List<String> wikilinkTargets = new ArrayList<>();
        public List<String> headings = new ArrayList<>();
        public List<String> tags = new ArrayList<>();
        public long wordCount;
    }

    /**
     * 解析 Markdown 文本为完整的解析结果。
     */
    public ParseResult parse(String markdown) {
        ParseResult result = new ParseResult();
        if (markdown == null || markdown.isEmpty()) {
            result.body = "";
            return result;
        }

        FrontmatterParser.ParseResult fp = frontmatterParser.parse(markdown);
        result.frontmatter = fp.frontmatter;
        result.body = fp.body;

        // 标题提取
        Matcher h1 = H1_PATTERN.matcher(result.body);
        if (h1.find()) {
            result.title = h1.group(1).trim();
        }
        if (result.title == null) {
            // 从文件名推断（外部调用覆盖）
            result.title = "Untitled";
        }

        // 全部标题
        Matcher hm = HEADING_PATTERN.matcher(result.body);
        while (hm.find()) {
            result.headings.add(hm.group(2).trim());
        }

        // Wikilink
        result.wikilinkTargets = wikilinkExtractor.extract(result.body);

        // 标签：从 frontmatter + 全文 #tag 抽取
        result.tags = extractTags(markdown, fp.frontmatter);

        // 字数（去除代码块）
        String plain = stripCodeBlocks(result.body);
        result.wordCount = countWords(plain);

        return result;
    }

    /** 解析并填充到 Document 对象 */
    public Document parseIntoDocument(String markdown, String workspace, List<String> overrideTags) {
        ParseResult pr = parse(markdown);
        Document doc = new Document();
        doc.setWorkspace(workspace);
        doc.setTitle(pr.title);
        doc.setContent(markdown);
        doc.setBody(pr.body);
        doc.setFrontmatter(pr.frontmatter);
        doc.setTags(overrideTags != null && !overrideTags.isEmpty() ? new ArrayList<>(overrideTags) : pr.tags);
        doc.setWordCount(pr.wordCount);
        // 元数据抽取
        Object sourceUrl = pr.frontmatter.get("yuque_url");
        if (sourceUrl != null) doc.setSourceUrl(sourceUrl.toString());
        Object author = pr.frontmatter.get("author");
        if (author != null) doc.setAuthor(author.toString());
        Object category = pr.frontmatter.get("category");
        if (category != null) doc.setCategory(category.toString());
        return doc;
    }

    /** 渲染 Markdown 为 HTML（用于前端预览） */
    public String renderHtml(String markdown) {
        if (markdown == null) return "";
        // 简单实现：去除 Markdown 标记，返回纯文本 + 段落
        // 完整实现可接入 flexmark-java
        return basicMarkdownToHtml(markdown);
    }

    /** 转为纯文本（去除 Markdown 标记 + HTML 标签 + 代码块） */
    public String toPlainText(String markdown) {
        if (markdown == null) return "";
        String s = stripCodeBlocks(markdown);
        s = LINK_REFERENCE_PATTERN.matcher(s).replaceAll("$1");
        s = s.replaceAll("[#*_>`~\\-|]", " ");
        s = Jsoup.clean(s, "", Safelist.none(), new OutputSettings().prettyPrint(false));
        return s.replaceAll("\\s+", " ").trim();
    }

    private String basicMarkdownToHtml(String md) {
        StringBuilder sb = new StringBuilder();
        String[] lines = md.split("\\n", -1);
        boolean inCode = false;
        boolean inList = false;
        for (String line : lines) {
            if (line.trim().startsWith("```")) {
                if (inCode) { sb.append("</code></pre>\n"); inCode = false; }
                else { sb.append("<pre><code>"); inCode = true; }
                continue;
            }
            if (inCode) { sb.append(escapeHtml(line)).append("\n"); continue; }

            if (line.matches("^#{1,6}\\s+.*")) {
                int level = 0;
                while (level < line.length() && line.charAt(level) == '#') level++;
                String text = line.substring(level).trim();
                sb.append("<h").append(level).append(">")
                  .append(processInline(text)).append("</h").append(level).append(">\n");
            } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                if (!inList) { sb.append("<ul>\n"); inList = true; }
                sb.append("<li>").append(processInline(line.trim().substring(2))).append("</li>\n");
            } else if (line.trim().isEmpty()) {
                if (inList) { sb.append("</ul>\n"); inList = false; }
                sb.append("\n");
            } else {
                if (inList) { sb.append("</ul>\n"); inList = false; }
                sb.append("<p>").append(processInline(line)).append("</p>\n");
            }
        }
        if (inList) sb.append("</ul>\n");
        if (inCode) sb.append("</code></pre>\n");
        return sb.toString();
    }

    private String processInline(String text) {
        String s = escapeHtml(text);
        s = s.replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>");
        s = s.replaceAll("\\*([^*]+)\\*", "<em>$1</em>");
        s = s.replaceAll("`([^`]+)`", "<code>$1</code>");
        s = LINK_REFERENCE_PATTERN.matcher(s).replaceAll("<a href=\"$2\">$1</a>");
        return s;
    }

    private String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String stripCodeBlocks(String s) {
        return CODE_BLOCK_PATTERN.matcher(s).replaceAll("");
    }

    private long countWords(String s) {
        if (s == null || s.isEmpty()) return 0;
        long count = 0;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            if (Character.isWhitespace(cp)) {
                i += Character.charCount(cp);
                continue;
            }
            count++;
            i += Character.charCount(cp);
        }
        return count;
    }

    /** 抽取标签：frontmatter tags + 全文 #tag */
    @SuppressWarnings("unchecked")
    private List<String> extractTags(String markdown, Map<String, Object> fm) {
        java.util.LinkedHashSet<String> tags = new java.util.LinkedHashSet<>();
        // frontmatter tags
        Object t = fm.get("tags");
        if (t instanceof List) {
            for (Object o : (List<Object>) t) tags.add(o.toString().trim());
        } else if (t instanceof String) {
            String[] parts = ((String) t).split(",");
            for (String p : parts) tags.add(p.trim());
        }
        // 全文 #tag（不在代码块内）
        String plain = stripCodeBlocks(markdown);
        Matcher m = Pattern.compile("#([\\p{L}\\p{N}_\\-\\u4e00-\\u9fff]+)").matcher(plain);
        while (m.find()) {
            String tag = m.group(1).trim();
            if (tag.length() >= 2) tags.add(tag);
        }
        return new ArrayList<>(tags);
    }
}
