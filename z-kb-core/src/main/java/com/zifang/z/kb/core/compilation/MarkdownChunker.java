package com.zifang.z.kb.core.compilation;

import com.zifang.z.kb.api.compilation.ChunkRole;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Markdown 切块：按标题成节，节内按段落与句末切分并带重叠，HTML 表格先渲染成行文本。
 *
 * <p>每个标题节的正文超过单块上限时，先产出一个 SECTION 块承载整节上下文，再产出若干 PASSAGE 块
 * 并回指该 SECTION；未超上限的节只产出一个 PASSAGE 块，召回以 PASSAGE 为准。</p>
 *
 * <p>语义逐字对齐参考实现的 local-chunker-v2：上限、重叠与截断常量都不改，避免编译产物版本
 * 口径漂移。</p>
 */
public final class MarkdownChunker {

    /** 单个召回块的最大字符数。 */
    public static final int MAX_PASSAGE_CHARS = 500;

    /** 长段落切分时相邻块回带的上文最大字符数。 */
    public static final int OVERLAP_CHARS = 80;

    /** 章节块承载的最大字符数，超出部分只留在段落块里。 */
    public static final int MAX_SECTION_CHARS = 4000;

    /** 单份物料最多产出的块数。 */
    public static final int MAX_CHUNKS = 2000;

    /** 标题列的最大字符数，与库字段长度对齐。 */
    public static final int MAX_HEADING_CHARS = 255;

    private static final Pattern TABLE_PATTERN =
            Pattern.compile("<table[^>]*>(.*?)</table>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern ROW_PATTERN =
            Pattern.compile("<tr[^>]*>(.*?)</tr>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern CELL_PATTERN =
            Pattern.compile("<t[dh][^>]*>(.*?)</t[dh]>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]+>");

    private static final Pattern SENTENCE_PATTERN = Pattern.compile("[^。！？；!?;\\n]+[。！？；!?;]?");

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("^@@TABLE(\\d+)@@$");

    /** 按标题切分正文，返回按文档顺序排列的块。 */
    public List<Chunk> split(String text, String fallbackHeading) {
        List<Chunk> chunks = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return chunks;
        }
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        List<Paragraph> tables = new ArrayList<>();
        String withPlaceholders = replaceTables(normalized, tables);

        String heading = normalizeHeading(fallbackHeading);
        List<Paragraph> paragraphs = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();
        for (String rawLine : withPlaceholders.split("\n", -1)) {
            String line = rawLine.trim();
            if (line.startsWith("#")) {
                appendParagraph(paragraphs, buffer);
                flushSection(chunks, heading, paragraphs);
                paragraphs.clear();
                heading = normalizeHeading(line.replaceFirst("^#+\\s*", ""));
                continue;
            }
            Matcher placeholder = PLACEHOLDER_PATTERN.matcher(line);
            if (placeholder.matches()) {
                appendParagraph(paragraphs, buffer);
                paragraphs.add(tables.get(Integer.parseInt(placeholder.group(1))));
                continue;
            }
            if (line.isEmpty()) {
                appendParagraph(paragraphs, buffer);
                continue;
            }
            if (buffer.length() > 0) {
                buffer.append('\n');
            }
            buffer.append(line);
        }
        appendParagraph(paragraphs, buffer);
        flushSection(chunks, heading, paragraphs);
        return chunks;
    }

    /** 把 HTML 表格换成占位行，并预渲染成行文本。 */
    private String replaceTables(String text, List<Paragraph> tables) {
        Matcher matcher = TABLE_PATTERN.matcher(text);
        StringBuffer output = new StringBuffer();
        int index = 0;
        while (matcher.find()) {
            tables.add(Paragraph.table(renderRows(matcher.group(1))));
            matcher.appendReplacement(output, "\n@@TABLE" + index + "@@\n");
            index++;
        }
        matcher.appendTail(output);
        return output.toString();
    }

    /** 解析表格行与单元格，单元格用竖线连接，保留空列以免错位。 */
    private List<String> renderRows(String html) {
        List<String> rows = new ArrayList<>();
        Matcher rowMatcher = ROW_PATTERN.matcher(html);
        while (rowMatcher.find()) {
            List<String> cells = new ArrayList<>();
            Matcher cellMatcher = CELL_PATTERN.matcher(rowMatcher.group(1));
            while (cellMatcher.find()) {
                cells.add(cleanCell(cellMatcher.group(1)));
            }
            StringBuilder row = new StringBuilder();
            boolean blank = true;
            for (String cell : cells) {
                if (row.length() > 0) {
                    row.append(" | ");
                }
                row.append(cell);
                if (!cell.isEmpty()) {
                    blank = false;
                }
            }
            if (!blank) {
                rows.add(row.toString());
            }
        }
        if (rows.isEmpty()) {
            String plain = cleanCell(html);
            if (!plain.isEmpty()) {
                rows.add(plain);
            }
        }
        return rows;
    }

    /** 去掉单元格里的标签与实体，压缩空白。 */
    private String cleanCell(String cell) {
        String plain = TAG_PATTERN.matcher(cell).replaceAll(" ");
        plain = plain.replace("&nbsp;", " ").replace("&emsp;", " ").replace("&ensp;", " ")
                .replace("&middot;", "·")
                .replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&amp;", "&");
        return plain.replaceAll("[\\s\\u00a0]+", " ").trim();
    }

    /** 缓冲区内容作为段落落盘。 */
    private void appendParagraph(List<Paragraph> paragraphs, StringBuilder buffer) {
        String text = buffer.toString().trim();
        buffer.setLength(0);
        if (!text.isEmpty()) {
            paragraphs.add(Paragraph.text(text));
        }
    }

    /** 输出一节：整节不超长时只产段落块，超长时先产章节块再产回指它的段落块。 */
    private void flushSection(List<Chunk> chunks, String heading, List<Paragraph> paragraphs) {
        if (paragraphs.isEmpty() || chunks.size() >= MAX_CHUNKS) {
            return;
        }
        String sectionText = joinParagraphs(paragraphs);
        if (sectionText.length() <= MAX_PASSAGE_CHARS) {
            chunks.add(new Chunk(heading, sectionText, ChunkRole.PASSAGE, -1));
            return;
        }
        int sectionIndex = chunks.size();
        chunks.add(new Chunk(heading, truncate(sectionText, MAX_SECTION_CHARS), ChunkRole.SECTION, -1));
        for (String passage : splitParagraphs(paragraphs)) {
            if (chunks.size() >= MAX_CHUNKS) {
                return;
            }
            chunks.add(new Chunk(heading, passage, ChunkRole.PASSAGE, sectionIndex));
        }
    }

    /** 把一节内的段落装箱成不超过单块上限的段落块。 */
    private List<String> splitParagraphs(List<Paragraph> paragraphs) {
        List<String> passages = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();
        for (Paragraph paragraph : paragraphs) {
            if (paragraph.isTable()) {
                passages.addAll(flushBuffer(buffer));
                passages.addAll(splitTable(paragraph.rows));
                continue;
            }
            if (paragraph.text.length() > MAX_PASSAGE_CHARS) {
                passages.addAll(flushBuffer(buffer));
                passages.addAll(splitSentences(paragraph.text));
                continue;
            }
            int extra = paragraph.text.length() + (buffer.length() > 0 ? 1 : 0);
            if (buffer.length() > 0 && buffer.length() + extra > MAX_PASSAGE_CHARS) {
                passages.addAll(flushBuffer(buffer));
            }
            if (buffer.length() > 0) {
                buffer.append('\n');
            }
            buffer.append(paragraph.text);
        }
        passages.addAll(flushBuffer(buffer));
        return passages;
    }

    /** 取出缓冲区内容并清空，空缓冲区返回空列表。 */
    private List<String> flushBuffer(StringBuilder buffer) {
        List<String> out = new ArrayList<>();
        String text = buffer.toString().trim();
        buffer.setLength(0);
        if (!text.isEmpty()) {
            out.add(text);
        }
        return out;
    }

    /** 表格按行装箱，续块补表头，避免行与表头分离。 */
    private List<String> splitTable(List<String> rows) {
        List<String> passages = new ArrayList<>();
        if (rows.isEmpty()) {
            return passages;
        }
        String header = rows.get(0);
        StringBuilder buffer = new StringBuilder();
        for (String row : rows) {
            if (row.length() > MAX_PASSAGE_CHARS) {
                passages.addAll(flushBuffer(buffer));
                for (String piece : hardCut(row)) {
                    passages.add(passages.isEmpty() || piece.startsWith(header) ? piece : header + "\n" + piece);
                }
                continue;
            }
            int extra = row.length() + (buffer.length() > 0 ? 1 : 0);
            if (buffer.length() > 0 && buffer.length() + extra > MAX_PASSAGE_CHARS) {
                List<String> done = flushBuffer(buffer);
                for (String piece : done) {
                    passages.add(passages.isEmpty() || piece.startsWith(header) ? piece : header + "\n" + piece);
                }
            }
            if (buffer.length() > 0) {
                buffer.append('\n');
            }
            buffer.append(row);
        }
        for (String piece : flushBuffer(buffer)) {
            passages.add(passages.isEmpty() || piece.startsWith(header) ? piece : header + "\n" + piece);
        }
        return passages;
    }

    /** 长段落按句末切分，相邻块回带上一块尾部若干整句作为重叠。 */
    private List<String> splitSentences(String text) {
        List<String> sentences = new ArrayList<>();
        Matcher matcher = SENTENCE_PATTERN.matcher(text);
        while (matcher.find()) {
            String sentence = matcher.group().trim();
            if (!sentence.isEmpty()) {
                sentences.add(sentence);
            }
        }
        List<String> passages = new ArrayList<>();
        if (sentences.isEmpty()) {
            return hardCut(text);
        }
        int start = 0;
        while (start < sentences.size()) {
            if (sentences.get(start).length() > MAX_PASSAGE_CHARS) {
                passages.addAll(hardCut(sentences.get(start)));
                start++;
                continue;
            }
            StringBuilder buffer = new StringBuilder();
            int cursor = start;
            while (cursor < sentences.size() && sentences.get(cursor).length() <= MAX_PASSAGE_CHARS) {
                int extra = sentences.get(cursor).length() + (buffer.length() > 0 ? 1 : 0);
                if (buffer.length() > 0 && buffer.length() + extra > MAX_PASSAGE_CHARS) {
                    break;
                }
                if (buffer.length() > 0) {
                    buffer.append('\n');
                }
                buffer.append(sentences.get(cursor));
                cursor++;
            }
            passages.add(buffer.toString());
            if (cursor >= sentences.size()) {
                break;
            }
            int next = cursor;
            int overlap = 0;
            while (next > start + 1 && overlap + sentences.get(next - 1).length() <= OVERLAP_CHARS) {
                next--;
                overlap += sentences.get(next).length();
            }
            start = next;
        }
        return passages;
    }

    /** 单句超过上限时按定长硬切，保证不超过库字段与检索限制。 */
    private List<String> hardCut(String text) {
        List<String> pieces = new ArrayList<>();
        int offset = 0;
        while (offset < text.length()) {
            int end = Math.min(offset + MAX_PASSAGE_CHARS, text.length());
            pieces.add(text.substring(offset, end).trim());
            offset = end;
        }
        return pieces;
    }

    /** 拼接整节正文，段落之间换行，表头行分隔。 */
    private String joinParagraphs(List<Paragraph> paragraphs) {
        StringBuilder joined = new StringBuilder();
        for (Paragraph paragraph : paragraphs) {
            String text = paragraph.isTable() ? String.join("\n", paragraph.rows) : paragraph.text;
            if (text.isEmpty()) {
                continue;
            }
            if (joined.length() > 0) {
                joined.append('\n');
            }
            joined.append(text);
        }
        return joined.toString();
    }

    /** 去掉标题里的井号与加粗标记，空标题回落为物料标题。 */
    private String normalizeHeading(String heading) {
        if (heading == null) {
            return null;
        }
        String cleaned = heading.replaceFirst("^#+\\s*", "").replace("**", "").replace("__", "").trim();
        return cleaned.isEmpty() ? null : truncate(cleaned, MAX_HEADING_CHARS);
    }

    /** 字符串超过指定长度时截断，null 原样返回。 */
    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** 段落：普通正文或预渲染的表格行。 */
    private static final class Paragraph {

        private final String text;

        private final List<String> rows;

        private Paragraph(String text, List<String> rows) {
            this.text = text;
            this.rows = rows;
        }

        private static Paragraph text(String text) {
            return new Paragraph(text, null);
        }

        private static Paragraph table(List<String> rows) {
            return new Paragraph(null, rows);
        }

        private boolean isTable() {
            return rows != null;
        }
    }

    /** 切块结果：角色、正文、标题与父块下标。 */
    public static final class Chunk {

        private final String heading;

        private final String content;

        private final ChunkRole role;

        private final int parentIndex;

        private Chunk(String heading, String content, ChunkRole role, int parentIndex) {
            this.heading = heading;
            this.content = content;
            this.role = role;
            this.parentIndex = parentIndex;
        }

        public String getHeading() {
            return heading;
        }

        public String getContent() {
            return content;
        }

        public ChunkRole getRole() {
            return role;
        }

        public int getParentIndex() {
            return parentIndex;
        }
    }
}
