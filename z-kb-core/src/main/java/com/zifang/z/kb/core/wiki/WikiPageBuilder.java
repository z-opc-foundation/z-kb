package com.zifang.z.kb.core.wiki;

import com.zifang.z.kb.api.wiki.WikiPointView;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Wiki 页面构建口径：按 Markdown 标题切分要点、拼装/回解正文、摘要与内容指纹。
 *
 * <p>口径对齐参考实现：单点最长 1200 字、单页最多 50 点；规则页正文为
 * {@code ## 标题 + 空行 + 正文} 分块；摘要取首个要点正文前 160 字。</p>
 */
public final class WikiPageBuilder {

    public static final int MAX_POINTS = 50;

    public static final int MAX_POINT_CHARS = 1200;

    public static final int MAX_SUMMARY_CHARS = 160;

    public static final int MAX_CHUNK_IDS_CHARS = 2000;

    private static final String FALLBACK_TITLE = "未命名 Wiki";

    private static final String FALLBACK_HEADING = "正文";

    private WikiPageBuilder() {
    }

    /** 按 Markdown 标题切分要点，无标题时用 fallbackHeading 兜底。 */
    public static List<WikiPointView> splitPoints(String text, String fallbackHeading) {
        List<WikiPointView> points = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return points;
        }
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        String heading = null;
        StringBuilder buffer = new StringBuilder();
        for (String rawLine : normalized.split("\n", -1)) {
            String line = rawLine.trim();
            if (line.startsWith("#")) {
                heading = flushPoint(points, heading, buffer, fallbackHeading);
                heading = line.replaceFirst("^#+\\s*", "").trim();
                continue;
            }
            if (line.isEmpty()) {
                if (buffer.length() > 0) {
                    buffer.append('\n');
                }
                continue;
            }
            if (buffer.length() > 0) {
                buffer.append('\n');
            }
            buffer.append(line);
            if (buffer.length() >= MAX_POINT_CHARS) {
                heading = flushPoint(points, heading, buffer, fallbackHeading);
            }
            if (points.size() >= MAX_POINTS) {
                return points;
            }
        }
        flushPoint(points, heading, buffer, fallbackHeading);
        if (points.isEmpty() && !normalized.trim().isEmpty()) {
            WikiPointView point = new WikiPointView();
            point.setHeading(fallbackHeading);
            point.setText(truncate(normalized.trim(), MAX_POINT_CHARS));
            points.add(point);
        }
        return points;
    }

    /** 把要点列表拼装为以「## 标题 + 空行 + 正文」分块的 Markdown 内容。 */
    public static String buildContent(List<WikiPointView> points) {
        StringBuilder builder = new StringBuilder();
        for (WikiPointView point : points) {
            builder.append("## ").append(point.getHeading()).append("\n\n")
                    .append(point.getText()).append("\n\n");
        }
        return builder.toString().trim();
    }

    /** 把 {@link #buildContent} 生成的 Markdown 反解为要点列表。 */
    public static List<WikiPointView> parsePoints(String content) {
        List<WikiPointView> points = new ArrayList<>();
        if (content == null || content.trim().isEmpty()) {
            return points;
        }
        String body = content;
        if (body.regionMatches(true, 0, "SUMMARY:", 0, 8)) {
            int lineEnd = body.indexOf('\n');
            body = lineEnd < 0 ? "" : body.substring(lineEnd + 1);
        }
        if (body.trim().isEmpty()) {
            return points;
        }
        if (!body.startsWith("## ") && !body.contains("\n## ")) {
            WikiPointView point = new WikiPointView();
            point.setHeading(FALLBACK_HEADING);
            point.setText(body.trim());
            points.add(point);
            return points;
        }
        for (String block : body.split("\n## ")) {
            String normalized = block.startsWith("## ") ? block.substring(3) : block;
            int split = normalized.indexOf("\n\n");
            WikiPointView point = new WikiPointView();
            if (split < 0) {
                point.setHeading(normalized.trim());
                point.setText("");
            } else {
                point.setHeading(normalized.substring(0, split).trim());
                point.setText(normalized.substring(split + 2).trim());
            }
            points.add(point);
        }
        return points;
    }

    /** 取首个要点的正文作为摘要，超长截断，无正文时使用 fallback。 */
    public static String summaryOf(List<WikiPointView> points, String fallback) {
        if (!points.isEmpty() && points.get(0).getText() != null
                && !points.get(0).getText().trim().isEmpty()) {
            String text = points.get(0).getText().replace('\n', ' ').trim();
            return truncate(text, MAX_SUMMARY_CHARS);
        }
        return fallback;
    }

    /** 从页面正文首行提取 SUMMARY，缺失时取正文前 80 字。 */
    public static String summaryFromContent(String content) {
        if (content == null) {
            return null;
        }
        for (String line : content.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.regionMatches(true, 0, "SUMMARY:", 0, 8)) {
                return truncate(trimmed.substring(8).trim(), MAX_SUMMARY_CHARS);
            }
            break;
        }
        return truncate(content.replaceAll("\\s+", " ").trim(), 80);
    }

    /** 统计全部要点正文的字符总数。 */
    public static int charCount(List<WikiPointView> points) {
        int count = 0;
        for (WikiPointView point : points) {
            if (point.getText() != null) {
                count += point.getText().length();
            }
        }
        return count;
    }

    /** 去掉文件扩展名作为 Wiki 标题，空标题返回「未命名 Wiki」。 */
    public static String stripExtension(String title) {
        if (title == null || title.trim().isEmpty()) {
            return FALLBACK_TITLE;
        }
        String trimmed = title.trim();
        int dot = trimmed.lastIndexOf('.');
        return dot > 0 ? trimmed.substring(0, dot) : trimmed;
    }

    /** 要点数量按引用的证据块去重统计，上限 50。 */
    public static int pointCount(List<String> chunkIds) {
        if (chunkIds == null || chunkIds.isEmpty()) {
            return 0;
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String chunkId : chunkIds) {
            if (chunkId != null && !chunkId.trim().isEmpty()) {
                unique.add(chunkId.trim());
            }
        }
        return Math.min(unique.size(), MAX_POINTS);
    }

    /** 证据块编码去重后用逗号拼接，超长时截断。 */
    public static String joinChunkIds(List<String> chunkIds) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (chunkIds != null) {
            for (String chunkId : chunkIds) {
                if (chunkId != null && !chunkId.trim().isEmpty()) {
                    unique.add(chunkId.trim());
                }
            }
        }
        return truncate(String.join(",", unique), MAX_CHUNK_IDS_CHARS);
    }

    /** 逗号分隔的块编码还原为列表。 */
    public static List<String> splitChunkIds(String joined) {
        List<String> result = new ArrayList<>();
        if (joined == null || joined.trim().isEmpty()) {
            return result;
        }
        for (String part : joined.split(",")) {
            if (part != null && !part.trim().isEmpty()) {
                result.add(part.trim());
            }
        }
        return result;
    }

    /** 超长文本截断，保留上限长度；null 原样返回。 */
    public static String truncate(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max);
    }

    /** 计算字符串的 SHA-256 十六进制摘要，用作页面与目录的内容版本哈希。 */
    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /** 将当前缓冲区内容落为一个要点并清空缓冲区，内容为空或已达上限时不追加。 */
    private static String flushPoint(List<WikiPointView> points, String heading,
                                     StringBuilder buffer, String fallbackHeading) {
        String content = buffer.toString().trim();
        buffer.setLength(0);
        if (content.isEmpty() || points.size() >= MAX_POINTS) {
            return heading;
        }
        WikiPointView point = new WikiPointView();
        boolean hasHeading = heading != null && !heading.trim().isEmpty();
        point.setHeading(hasHeading ? heading
                : (points.isEmpty() ? fallbackHeading : FALLBACK_HEADING));
        point.setText(content);
        points.add(point);
        return heading;
    }
}
