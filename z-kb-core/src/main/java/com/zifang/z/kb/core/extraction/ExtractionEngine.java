package com.zifang.z.kb.core.extraction;

import com.zifang.z.kb.api.extraction.ExtractionChunk;
import com.zifang.z.kb.api.extraction.ExtractionInput;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 本地确定性萃取引擎。不调用 LLM，只按固定规则从检索块生成摘要、问句、术语、FAQ 与图谱。
 */
public class ExtractionEngine {

    public static final String TYPE_SUMMARY = "SUMMARY";

    public static final String TYPE_QUESTION = "QUESTION";

    public static final String TYPE_TERM = "TERM";

    public static final String TYPE_FAQ = "FAQ";

    public static final String NODE_MATERIAL = "MATERIAL";

    public static final String NODE_CONCEPT = "CONCEPT";

    public static final String EDGE_MENTIONS = "MENTIONS";

    public static final String EDGE_RELATED_TO = "RELATED_TO";

    private static final int MAX_SUMMARY_CHARS = 300;

    private static final int MAX_QUESTIONS = 5;

    private static final int MAX_TERMS = 5;

    private static final int MAX_FAQ = 5;

    private static final int MAX_TERM_DEFINITION_CHARS = 200;

    private static final int MAX_FAQ_ANSWER_CHARS = 300;

    private static final int MAX_RELATED_EDGES = 10;

    private static final int MAX_NAME_CHARS = 255;

    private static final Pattern CJK_RUN = Pattern.compile("[\\u4e00-\\u9fa5]{2,}");

    private static final Pattern HEADING_SPLIT =
            Pattern.compile("[\\s，,、。；;：:（）()【】\\[\\]《》/·\\-—_]+");

    private static final String SENTENCE_END = "。！？!?；;";

    private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList(
            "什么", "如何", "哪些", "我们", "可以", "需要", "进行", "以及", "一个", "这是", "其中",
            "对于", "通过", "相关", "内容", "包含", "主要", "根据", "如下", "上述", "同时", "并且",
            "或者", "如果", "因为", "所以", "但是", "已经", "没有", "不是", "就是", "这些", "那些",
            "每个", "各自", "按照", "应当", "必须", "不得", "本文", "本文件", "该文件", "上述内容"));

    /**
     * 对一份物料版本的检索块执行本地规则萃取，返回尚未落库的条目、图谱与概念候选。
     */
    public ExtractionResult extract(ExtractionInput input) {
        ExtractionResult result = new ExtractionResult();
        if (input == null || input.getChunks() == null) {
            return result;
        }
        List<ExtractionChunk> chunks = input.getChunks();
        String title = trimToDefault(stripExtension(input.getMaterialTitle()), "未命名物料");
        String fullText = joinContent(chunks);
        List<String> headings = distinctHeadings(chunks, title);

        appendSummary(result.getItems(), title, fullText);
        List<TermCandidate> terms = collectTerms(fullText, headings);
        appendQuestions(result.getItems(), headings, title, chunks);
        Map<String, ExtractionItemDraft> termItems = appendTerms(result.getItems(), terms, chunks);
        appendFaq(result.getItems(), headings, title, chunks);
        appendGraph(input, result, title, headings, termItems, chunks);
        return result;
    }

    /** 将全文摘要作为一个 SUMMARY 类型条目追加到结果列表。 */
    private void appendSummary(List<ExtractionItemDraft> items, String title, String fullText) {
        String summary = summarize(fullText);
        if (!hasText(summary)) {
            return;
        }
        items.add(item(TYPE_SUMMARY, 1, title, summary, evidence(0, 0, summary.length())));
    }

    /** 按标题为每个章节生成“是什么/包含哪些内容”问句，最多 MAX_QUESTIONS 条。 */
    private void appendQuestions(List<ExtractionItemDraft> items, List<String> headings,
                                 String title, List<ExtractionChunk> chunks) {
        List<String> targets = headings.isEmpty() ? Collections.singletonList(title) : headings;
        int seq = 0;
        for (String heading : targets) {
            if (seq >= MAX_QUESTIONS) {
                break;
            }
            String base = trimToDefault(heading, title);
            String first = base + "是什么？";
            seq++;
            items.add(item(TYPE_QUESTION, seq, first, first,
                    evidence(headingOrdinal(chunks, base), 0, first.length())));
            if (seq >= MAX_QUESTIONS) {
                break;
            }
            String second = base + "包含哪些内容？";
            seq++;
            items.add(item(TYPE_QUESTION, seq, second, second,
                    evidence(headingOrdinal(chunks, base), 0, second.length())));
        }
    }

    /** 为每个候选术语取首个包含它的句子作为释义，生成 TERM 条目并附带证据位置。 */
    private Map<String, ExtractionItemDraft> appendTerms(List<ExtractionItemDraft> items,
                                                          List<TermCandidate> terms,
                                                          List<ExtractionChunk> chunks) {
        Map<String, ExtractionItemDraft> byTitle = new LinkedHashMap<>();
        int seq = 0;
        for (TermCandidate term : terms) {
            if (seq >= MAX_TERMS) {
                break;
            }
            seq++;
            String definition = firstSentenceContaining(chunks, term.name);
            if (!hasText(definition)) {
                definition = term.name;
            }
            ExtractionItemDraft draft = item(TYPE_TERM, seq, term.name,
                    truncate(definition, MAX_TERM_DEFINITION_CHARS),
                    evidence(termOrdinal(chunks, term.name), 0,
                            Math.min(definition.length(), MAX_TERM_DEFINITION_CHARS)));
            items.add(draft);
            byTitle.putIfAbsent(term.name, draft);
        }
        return byTitle;
    }

    /** 用各章节首段作为答案拼出 FAQ 条目，无正文的章节跳过，最多 MAX_FAQ 条。 */
    private void appendFaq(List<ExtractionItemDraft> items, List<String> headings, String title,
                           List<ExtractionChunk> chunks) {
        List<String> targets = headings.isEmpty() ? Collections.singletonList(title) : headings;
        int seq = 0;
        for (String heading : targets) {
            if (seq >= MAX_FAQ) {
                break;
            }
            String answer = firstParagraph(chunks, heading);
            if (!hasText(answer)) {
                continue;
            }
            seq++;
            String question = heading.endsWith("？") || heading.endsWith("?")
                    ? heading : heading + "是什么？";
            items.add(item(TYPE_FAQ, seq, truncate(question, MAX_NAME_CHARS),
                    truncate(answer, MAX_FAQ_ANSWER_CHARS),
                    evidence(headingOrdinal(chunks, heading), 0,
                            Math.min(answer.length(), MAX_FAQ_ANSWER_CHARS))));
        }
    }

    /** 构建物料节点与概念节点，并生成 MENTIONS 及同块共现的 RELATED_TO 边（含去重与数量上限）。 */
    private void appendGraph(ExtractionInput input, ExtractionResult result, String title,
                             List<String> headings, Map<String, ExtractionItemDraft> termItems,
                             List<ExtractionChunk> chunks) {
        ExtractionNodeDraft materialNode = new ExtractionNodeDraft();
        materialNode.setNodeId("material:" + input.getMaterialId());
        materialNode.setNodeType(NODE_MATERIAL);
        materialNode.setName(truncate(title, MAX_NAME_CHARS));
        materialNode.setMaterialId(input.getMaterialId());
        materialNode.setEvidenceJson(materialEvidence(input));
        result.getNodes().add(materialNode);

        Map<String, ExtractionNodeDraft> conceptNodes = new LinkedHashMap<>();
        Set<String> conceptNames = new LinkedHashSet<>();
        for (String name : termItems.keySet()) {
            conceptNames.add(name);
        }
        for (String heading : headings) {
            String name = trimToDefault(heading, null);
            if (hasText(name)) {
                conceptNames.add(truncate(name, MAX_NAME_CHARS));
            }
        }
        for (String name : conceptNames) {
            String nodeId = "concept:" + shortHash(input.getMaterialId() + "|" + name);
            String nodeEvidence = evidence(termOrdinal(chunks, name), 0, 0);
            ExtractionNodeDraft node = new ExtractionNodeDraft();
            node.setNodeId(nodeId);
            node.setNodeType(NODE_CONCEPT);
            node.setName(name);
            node.setMaterialId(input.getMaterialId());
            node.setEvidenceJson(nodeEvidence);
            conceptNodes.put(name, node);
            result.getNodes().add(node);

            ExtractionItemDraft termItem = termItems.get(name);
            ConceptCandidate candidate = new ConceptCandidate();
            candidate.setName(name);
            candidate.setDefinition(termItem == null ? null : termItem.getContent());
            candidate.setExtractionItemId(termItem == null ? null : termItem.getItemId());
            candidate.setChunkOrdinal(termOrdinal(chunks, name));
            candidate.setOccurrenceCount(countOccurrences(chunks, name));
            candidate.setEvidenceJson(nodeEvidence);
            result.getConcepts().add(candidate);
        }

        for (ExtractionNodeDraft concept : conceptNodes.values()) {
            result.getEdges().add(edge(EDGE_MENTIONS, materialNode.getNodeId(),
                    concept.getNodeId(), concept.getEvidenceJson()));
        }

        int relatedCount = 0;
        Set<String> pairKeys = new HashSet<>();
        for (ExtractionChunk chunk : chunks) {
            if (relatedCount >= MAX_RELATED_EDGES) {
                break;
            }
            List<String> present = new ArrayList<>();
            String haystack = (chunk.getHeading() == null ? "" : chunk.getHeading()) + "\n"
                    + (chunk.getContent() == null ? "" : chunk.getContent());
            for (ExtractionNodeDraft concept : conceptNodes.values()) {
                if (haystack.contains(concept.getName())) {
                    present.add(concept.getName());
                }
            }
            if (present.size() < 2) {
                continue;
            }
            Collections.sort(present);
            for (int i = 0; i < present.size() && relatedCount < MAX_RELATED_EDGES; i++) {
                for (int j = i + 1; j < present.size() && relatedCount < MAX_RELATED_EDGES; j++) {
                    ExtractionNodeDraft left = conceptNodes.get(present.get(i));
                    ExtractionNodeDraft right = conceptNodes.get(present.get(j));
                    String source = left.getNodeId().compareTo(right.getNodeId()) <= 0
                            ? left.getNodeId() : right.getNodeId();
                    String target = source.equals(left.getNodeId())
                            ? right.getNodeId() : left.getNodeId();
                    if (!pairKeys.add(source + "|" + target)) {
                        continue;
                    }
                    result.getEdges().add(edge(EDGE_RELATED_TO, source, target,
                            evidence(chunk.getOrdinal(), 0, 0)));
                    relatedCount++;
                }
            }
        }
    }

    /** 组装一条未落库的萃取条目，补齐类型、序号、标题、正文与证据。 */
    private ExtractionItemDraft item(String type, int seq, String title, String content,
                                     String evidenceJson) {
        ExtractionItemDraft draft = new ExtractionItemDraft();
        draft.setItemId(UUID.randomUUID().toString());
        draft.setItemType(type);
        draft.setSeq(seq);
        draft.setTitle(truncate(title, MAX_NAME_CHARS));
        draft.setContent(content);
        draft.setEvidenceJson(evidenceJson);
        return draft;
    }

    /** 组装一条图谱边，按源节点、目标节点与边类型生成确定性边 ID。 */
    private ExtractionEdgeDraft edge(String edgeType, String sourceNodeId, String targetNodeId,
                                     String evidenceJson) {
        ExtractionEdgeDraft draft = new ExtractionEdgeDraft();
        draft.setEdgeId(edgeId(sourceNodeId, targetNodeId, edgeType));
        draft.setEdgeType(edgeType);
        draft.setSourceNodeId(sourceNodeId);
        draft.setTargetNodeId(targetNodeId);
        draft.setEvidenceJson(evidenceJson);
        return draft;
    }

    /** 返回由源节点、目标节点和边类型哈希得到的稳定边 ID。 */
    public static String edgeId(String sourceNodeId, String targetNodeId, String edgeType) {
        return "edge:" + shortHash(sourceNodeId + "|" + targetNodeId + "|" + edgeType);
    }

    /** 返回知识库对应的图谱空间键（格式为 kb:{kbId}）。 */
    public static String graphSpaceKey(String kbId) {
        return "kb:" + kbId;
    }

    /** 从标题分词与正文 2-6 字中文串中收集术语，过滤停用词、低频项与包含冗余后取前 MAX_TERMS 个。 */
    private List<TermCandidate> collectTerms(String fullText, List<String> headings) {
        Map<String, TermCandidate> candidates = new LinkedHashMap<>();
        for (String heading : headings) {
            for (String segment : HEADING_SPLIT.split(heading)) {
                addHeadingCandidate(candidates, segment, fullText);
            }
            addHeadingCandidate(candidates, heading, fullText);
        }

        Matcher matcher = CJK_RUN.matcher(fullText);
        while (matcher.find()) {
            String run = matcher.group();
            int maxLength = Math.min(6, run.length());
            for (int length = 2; length <= maxLength; length++) {
                for (int start = 0; start + length <= run.length(); start++) {
                    String name = run.substring(start, start + length);
                    if (STOP_WORDS.contains(name)) {
                        continue;
                    }
                    candidates.computeIfAbsent(name, key -> new TermCandidate(key))
                            .increment();
                }
            }
        }

        List<TermCandidate> sorted = new ArrayList<>();
        for (TermCandidate candidate : candidates.values()) {
            if (!isValidTerm(candidate.name)) {
                continue;
            }
            if (!candidate.fromHeading && candidate.count < 2) {
                continue;
            }
            sorted.add(candidate);
        }
        sorted.sort(Comparator
                .comparing((TermCandidate candidate) -> candidate.fromHeading ? 0 : 1)
                .thenComparing(candidate -> -candidate.count)
                .thenComparing(candidate -> -candidate.name.length())
                .thenComparing(candidate -> candidate.name));

        List<TermCandidate> selected = new ArrayList<>();
        for (TermCandidate candidate : sorted) {
            if (selected.size() >= MAX_TERMS) {
                break;
            }
            boolean redundant = false;
            for (TermCandidate chosen : selected) {
                if (chosen.name.contains(candidate.name)
                        || candidate.name.contains(chosen.name)) {
                    redundant = true;
                    break;
                }
            }
            if (!redundant) {
                selected.add(candidate);
            }
        }
        return selected;
    }

    /** 将标题候选登记为术语，标记来自标题并补算全文出现次数（至少计 1 次）。 */
    private void addHeadingCandidate(Map<String, TermCandidate> candidates, String value,
                                     String fullText) {
        if (!isValidTerm(value) || STOP_WORDS.contains(value)) {
            return;
        }
        TermCandidate candidate = candidates.computeIfAbsent(value, TermCandidate::new);
        candidate.fromHeading = true;
        if (candidate.count == 0) {
            candidate.count = countOccurrences(fullText, value);
        }
        if (candidate.count == 0) {
            candidate.count = 1;
        }
    }

    private static boolean isValidTerm(String value) {
        if (!hasText(value)) {
            return false;
        }
        String trimmed = value.trim();
        if (trimmed.length() < 2 || trimmed.length() > 6) {
            return false;
        }
        for (int i = 0; i < trimmed.length(); i++) {
            if (trimmed.charAt(i) < '\u4e00' || trimmed.charAt(i) > '\u9fa5') {
                return false;
            }
        }
        return true;
    }

    /** 取前几句话拼成摘要，超出 300 字截断；无句子时退回全文压缩空白后的截断。 */
    private String summarize(String text) {
        List<String> sentences = sentences(text);
        StringBuilder builder = new StringBuilder();
        int count = 0;
        for (String sentence : sentences) {
            if (count >= 3 || builder.length() >= MAX_SUMMARY_CHARS) {
                break;
            }
            builder.append(sentence);
            count++;
            if (count >= 2 && builder.length() >= MAX_SUMMARY_CHARS) {
                break;
            }
        }
        if (builder.length() == 0 && hasText(text)) {
            return truncate(text.replace('\n', ' ').trim(), MAX_SUMMARY_CHARS);
        }
        return truncate(builder.toString(), MAX_SUMMARY_CHARS);
    }

    /** 返回首个包含指定术语的句子作为释义；找不到时退回同名标题下的首句，均无则返回 null。 */
    private String firstSentenceContaining(List<ExtractionChunk> chunks, String name) {
        for (ExtractionChunk chunk : chunks) {
            for (String sentence : sentences(chunk.getContent())) {
                if (sentence.contains(name)) {
                    return truncate(sentence, MAX_TERM_DEFINITION_CHARS);
                }
            }
        }
        for (ExtractionChunk chunk : chunks) {
            if (name.equals(chunk.getHeading())) {
                List<String> sentences = sentences(chunk.getContent());
                if (!sentences.isEmpty()) {
                    return truncate(sentences.get(0), MAX_TERM_DEFINITION_CHARS);
                }
            }
        }
        return null;
    }

    /** 取标题匹配块的内容首段（以空行分隔），换行折叠为空格；无匹配返回 null。 */
    private String firstParagraph(List<ExtractionChunk> chunks, String heading) {
        for (ExtractionChunk chunk : chunks) {
            if (heading.equals(chunk.getHeading()) && hasText(chunk.getContent())) {
                String content = chunk.getContent().replace("\r\n", "\n")
                        .replace('\r', '\n').trim();
                int split = content.indexOf("\n\n");
                String paragraph = split >= 0 ? content.substring(0, split) : content;
                return paragraph.replace('\n', ' ').trim();
            }
        }
        return null;
    }

    /** 返回标题匹配块的序号，未命中时退回首个块的序号。 */
    private int headingOrdinal(List<ExtractionChunk> chunks, String heading) {
        for (ExtractionChunk chunk : chunks) {
            if (heading.equals(chunk.getHeading())) {
                return chunk.getOrdinal();
            }
        }
        return firstOrdinal(chunks);
    }

    /** 返回首次出现术语的块序号（先匹配标题再匹配正文），未命中时退回首个块的序号。 */
    private int termOrdinal(List<ExtractionChunk> chunks, String name) {
        for (ExtractionChunk chunk : chunks) {
            if (name.equals(chunk.getHeading())) {
                return chunk.getOrdinal();
            }
            if (chunk.getContent() != null && chunk.getContent().contains(name)) {
                return chunk.getOrdinal();
            }
        }
        return firstOrdinal(chunks);
    }

    /** 返回首个检索块的序号，空列表返回 0。 */
    private static int firstOrdinal(List<ExtractionChunk> chunks) {
        return chunks.isEmpty() ? 0 : chunks.get(0).getOrdinal();
    }

    /** 按出现顺序收集去重后的非空块标题，全部为空时使用 fallback 作为唯一标题。 */
    private static List<String> distinctHeadings(List<ExtractionChunk> chunks, String fallback) {
        LinkedHashSet<String> headings = new LinkedHashSet<>();
        for (ExtractionChunk chunk : chunks) {
            if (hasText(chunk.getHeading())) {
                headings.add(chunk.getHeading().trim());
            }
        }
        if (headings.isEmpty() && hasText(fallback)) {
            headings.add(fallback);
        }
        return new ArrayList<>(headings);
    }

    /** 用换行拼接全部非空块内容，形成用于规则萃取的全文。 */
    private static String joinContent(List<ExtractionChunk> chunks) {
        StringBuilder builder = new StringBuilder();
        for (ExtractionChunk chunk : chunks) {
            if (hasText(chunk.getContent())) {
                if (builder.length() > 0) {
                    builder.append('\n');
                }
                builder.append(chunk.getContent().trim());
            }
        }
        return builder.toString();
    }

    /** 按换行与中文句末标点切分文本，返回去除首尾空白的句子列表。 */
    private static List<String> sentences(String text) {
        List<String> result = new ArrayList<>();
        if (!hasText(text)) {
            return result;
        }
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < normalized.length(); i++) {
            char ch = normalized.charAt(i);
            if (ch == '\n') {
                appendSentence(result, current);
                continue;
            }
            current.append(ch);
            if (SENTENCE_END.indexOf(ch) >= 0) {
                appendSentence(result, current);
            }
        }
        appendSentence(result, current);
        return result;
    }

    /** 将缓冲区中的句子去空白后加入结果列表并清空缓冲区，空句子丢弃。 */
    private static void appendSentence(List<String> result, StringBuilder current) {
        String sentence = current.toString().trim();
        current.setLength(0);
        if (!sentence.isEmpty()) {
            result.add(sentence);
        }
    }

    /** 统计子串在文本中不重叠出现的次数，入参为空时返回 0。 */
    private static int countOccurrences(String text, String name) {
        if (!hasText(text) || !hasText(name)) {
            return 0;
        }
        int count = 0;
        int index = text.indexOf(name);
        while (index >= 0) {
            count++;
            index = text.indexOf(name, index + name.length());
        }
        return count;
    }

    /** 统计名称在全部检索块的标题与正文中出现的总次数。 */
    private static int countOccurrences(List<ExtractionChunk> chunks, String name) {
        int count = 0;
        for (ExtractionChunk chunk : chunks) {
            count += countOccurrences(chunk.getHeading() == null ? "" : chunk.getHeading(), name);
            count += countOccurrences(chunk.getContent() == null ? "" : chunk.getContent(), name);
        }
        return count;
    }

    /** 生成包含块序号与字符起止位置的证据 JSON。 */
    private static String evidence(int chunk, int start, int end) {
        return "{\"chunk\":" + chunk + ",\"start\":" + start + ",\"end\":" + end + "}";
    }

    /** 生成物料节点的证据 JSON，包含物料版本 ID 与草稿 ID。 */
    private static String materialEvidence(ExtractionInput input) {
        return "{\"chunk\":0,\"start\":0,\"end\":0,\"materialVersionId\":\""
                + escape(input.getMaterialVersionId()) + "\",\"draftId\":\""
                + escape(input.getDraftId()) + "\"}";
    }

    /** 转义 JSON 字符串中的反斜杠与双引号，null 转为空串。 */
    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /** 去掉文件名最后一个扩展名，无内容返回 null，无扩展名时原样返回。 */
    private static String stripExtension(String title) {
        if (!hasText(title)) {
            return null;
        }
        String trimmed = title.trim();
        int dot = trimmed.lastIndexOf('.');
        return dot > 0 ? trimmed.substring(0, dot) : trimmed;
    }

    /** 去空白后返回值，为空则返回 fallback。 */
    private static String trimToDefault(String value, String fallback) {
        return hasText(value) ? value.trim() : fallback;
    }

    /** 将字符串截断到指定长度，null 原样返回。 */
    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** 返回输入值 SHA-256 十六进制前 24 位（12 字节），用于生成稳定节点与边标识。 */
    public static String shortHash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 12 && i < bytes.length; i++) {
                hex.append(Character.forDigit((bytes[i] >> 4) & 0xF, 16));
                hex.append(Character.forDigit(bytes[i] & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static final class TermCandidate {

        private final String name;

        private int count;

        private boolean fromHeading;

        private TermCandidate(String name) {
            this.name = name;
        }

        private void increment() {
            count++;
        }
    }
}
