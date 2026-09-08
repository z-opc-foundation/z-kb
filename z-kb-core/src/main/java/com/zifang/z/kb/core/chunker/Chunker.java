package com.zifang.z.kb.core.chunker;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.TokenEstimator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 智能分块器 — 标题感知 + Token 预算。
 *
 * <p>策略：
 * <ol>
 *   <li>按标题层级切分（H1/H2/H3 视为强制切分点）</li>
 *   <li>每段按 token 数累计，超过 {@code maxTokens} 时切分为新块</li>
 *   <li>相邻块保留 {@code overlapTokens} 的重叠</li>
 *   <li>过短的块（小于 {@code minTokens}）会与相邻块合并</li>
 * </ol>
 */
public class Chunker {

    private static final Logger log = LoggerFactory.getLogger(Chunker.class);

    /** 默认 token 预算（参考 RAGFlow） */
    public static final int DEFAULT_MAX_TOKENS = 256;
    public static final int DEFAULT_OVERLAP_TOKENS = 80;
    public static final int DEFAULT_MIN_TOKENS = 32;

    private static final Pattern HEADING_PATTERN = Pattern.compile("^(#{1,6})\\s+(.+?)\\s*$", Pattern.MULTILINE);

    private final int maxTokens;
    private final int overlapTokens;
    private final int minTokens;
    private final TokenEstimator tokenEstimator;

    public Chunker() {
        this(DEFAULT_MAX_TOKENS, DEFAULT_OVERLAP_TOKENS, DEFAULT_MIN_TOKENS, TokenEstimator.DEFAULT);
    }

    public Chunker(int maxTokens, int overlapTokens, int minTokens, TokenEstimator tokenEstimator) {
        this.maxTokens = maxTokens;
        this.overlapTokens = overlapTokens;
        this.minTokens = minTokens;
        this.tokenEstimator = tokenEstimator;
    }

    /**
     * 对文档进行分块。
     */
    public List<Chunk> chunk(Document doc) {
        if (doc == null || doc.getBody() == null || doc.getBody().isEmpty()) {
            return new ArrayList<>();
        }
        String body = doc.getBody();
        List<Section> sections = splitByHeadings(body);

        List<Chunk> chunks = new ArrayList<>();
        int ordinal = 0;
        for (Section section : sections) {
            List<Chunk> sectionChunks = chunkSection(doc, section, ordinal);
            chunks.addAll(sectionChunks);
            ordinal += sectionChunks.size();
        }
        // 设置 ordinal
        for (int i = 0; i < chunks.size(); i++) {
            chunks.get(i).setOrdinal(i);
        }
        doc.setChunkCount(chunks.size());
        return chunks;
    }

    private List<Section> splitByHeadings(String body) {
        List<Section> sections = new ArrayList<>();
        Matcher m = HEADING_PATTERN.matcher(body);
        int lastEnd = 0;
        int lastLevel = 0;
        String lastHeading = null;
        List<String> pathStack = new ArrayList<>();

        while (m.find()) {
            if (m.start() > lastEnd) {
                String content = body.substring(lastEnd, m.start()).trim();
                if (!content.isEmpty()) {
                    sections.add(new Section(lastLevel, lastHeading, new ArrayList<>(pathStack), content));
                }
            }
            int level = m.group(1).length();
            String heading = m.group(2).trim();

            // 维护路径栈
            while (pathStack.size() >= level) pathStack.remove(pathStack.size() - 1);
            pathStack.add(heading);

            lastEnd = m.end();
            lastLevel = level;
            lastHeading = heading;
        }
        // 剩余内容
        if (lastEnd < body.length()) {
            String content = body.substring(lastEnd).trim();
            if (!content.isEmpty()) {
                sections.add(new Section(lastLevel, lastHeading, new ArrayList<>(pathStack), content));
            }
        }
        return sections;
    }

    private List<Chunk> chunkSection(Document doc, Section section, int baseOrdinal) {
        List<Chunk> chunks = new ArrayList<>();
        String[] paragraphs = section.content.split("\\n\\s*\\n");
        StringBuilder buffer = new StringBuilder();
        String contextTitle = String.join(" > ", section.path);

        for (String p : paragraphs) {
            p = p.trim();
            if (p.isEmpty()) continue;

            // 累积段落
            if (buffer.length() > 0) buffer.append("\n\n");
            buffer.append(p);

            int tokens = tokenEstimator.estimate(buffer.toString());
            if (tokens >= maxTokens) {
                // 切块
                String chunkText = buffer.toString();
                // 如果单段超过 maxTokens，按句子硬切
                if (tokens > maxTokens * 1.5) {
                    chunks.addAll(splitLongText(doc, contextTitle, section.path, chunkText, baseOrdinal + chunks.size()));
                    buffer.setLength(0);
                } else {
                    chunks.add(buildChunk(doc, contextTitle, section.path, chunkText, baseOrdinal + chunks.size()));
                    // 保留 overlap
                    buffer.setLength(0);
                    String overlap = extractOverlap(chunkText, overlapTokens);
                    if (!overlap.isEmpty()) buffer.append(overlap);
                }
            }
        }

        // 收尾
        if (buffer.length() > 0) {
            int tokens = tokenEstimator.estimate(buffer.toString());
            if (tokens >= minTokens) {
                chunks.add(buildChunk(doc, contextTitle, section.path, buffer.toString(), baseOrdinal + chunks.size()));
            } else if (!chunks.isEmpty()) {
                // 过短：合并到上一块
                Chunk last = chunks.get(chunks.size() - 1);
                last.setContent(last.getContent() + "\n\n" + buffer.toString());
                last.setTokenEstimate(tokenEstimator.estimate(last.getContent()));
                last.setLength(last.getContent().length());
            } else {
                chunks.add(buildChunk(doc, contextTitle, section.path, buffer.toString(), baseOrdinal));
            }
        }
        return chunks;
    }

    /** 硬切超长文本 */
    private List<Chunk> splitLongText(Document doc, String contextTitle, List<String> path,
                                       String text, int baseOrdinal) {
        List<Chunk> chunks = new ArrayList<>();
        // 按句子切
        String[] sentences = text.split("(?<=[。！？!?\\.\\n])\\s*");
        StringBuilder buf = new StringBuilder();
        for (String sent : sentences) {
            if (buf.length() > 0) buf.append(" ");
            buf.append(sent);
            if (tokenEstimator.estimate(buf.toString()) >= maxTokens) {
                chunks.add(buildChunk(doc, contextTitle, path, buf.toString(), baseOrdinal + chunks.size()));
                buf.setLength(0);
            }
        }
        if (buf.length() > 0) {
            chunks.add(buildChunk(doc, contextTitle, path, buf.toString(), baseOrdinal + chunks.size()));
        }
        return chunks;
    }

    private String extractOverlap(String text, int overlapTokens) {
        if (overlapTokens <= 0) return "";
        // 取尾部若干 token 估算的字符数
        String[] sentences = text.split("(?<=[。！？!?\\.\\n])\\s*");
        StringBuilder sb = new StringBuilder();
        int tokens = 0;
        for (int i = sentences.length - 1; i >= 0; i--) {
            String s = sentences[i];
            int t = tokenEstimator.estimate(s);
            if (tokens + t > overlapTokens) break;
            sb.insert(0, s + " ");
            tokens += t;
        }
        return sb.toString().trim();
    }

    private Chunk buildChunk(Document doc, String contextTitle, List<String> path, String content, int ordinal) {
        Chunk chunk = Chunk.builder()
                .documentId(doc.getId())
                .workspace(doc.getWorkspace())
                .content(content)
                .contextTitle(contextTitle)
                .headingPath(new ArrayList<>(path))
                .length(content.length())
                .tokenEstimate(tokenEstimator.estimate(content))
                .createdAt(java.time.Instant.now())
                .build();
        chunk.setOrdinal(ordinal);
        return chunk;
    }

    private static class Section {
        final int level;
        final String heading;
        final List<String> path;
        final String content;
        Section(int level, String heading, List<String> path, String content) {
            this.level = level;
            this.heading = heading;
            this.path = path;
            this.content = content;
        }
    }
}
