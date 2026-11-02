package com.zifang.z.kb.modeling.extractor;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.modeling.model.ProductModel;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 因果链条抽取器 — 从知识库的文档里识别"因为 X 所以 Y"、"X 导致 Y"、"X → Y"等表达，
 * 产出 {@link ProductModel.CausalLink}。
 *
 * <p>核心实现：基于中文/英文因果连接词的模式匹配 + 启发式打分。
 * 不依赖 LLM，CPU 即可实时运行；后续可挂 LLM 增强置信度。
 *
 * <p>识别的中文连接词：因为、所以、因此、导致、使得、从而、引起、造成、结果、为了、为
 * 识别的英文连接词：because, so, therefore, thus, hence, leads to, results in, causes, enables, requires
 */
public class CausalChainExtractor {

    /** 因→果连接词（含捕获顺序：cause-group, effect-group） */
    private static final List<Pattern> PATTERNS = new ArrayList<>();

    static {
        // 中文
        addPattern("(.+?)(?:由于|因为|正因为|因为说)\\s*(.+?)(?:，|,|。|;|；|所以|因此|从而|使得|导致|造成|引起|以至于|带来)", 0.7);
        addPattern("(.+?)(?:所以|因此|从而|使得|导致|造成|引起|以至于|带来)\\s*(.+)", 0.7);
        addPattern("(.+?)为了\\s*(.+)", 0.6);
        addPattern("(.+?)会\\s*(?:导致|造成|引起|使得)\\s*(.+)", 0.65);
        addPattern("(.+?)可以\\s*(?:实现|达到|完成|支持)\\s*(.+)", 0.5);
        // 英文
        addPattern("(.+?)\\s+(?:because|since|as)\\s+(.+?)\\s+(?:so|thus|therefore|hence|causing|leading to)\\s*(.+)", 0.65);
        addPattern("(.+?)\\s+(?:so|thus|therefore|hence|consequently)\\s+(.+)", 0.7);
        addPattern("(.+?)\\s+(?:leads? to|results in|causes|enables|requires|triggers)\\s+(.+)", 0.75);
        // 箭头式：X → Y / X -> Y / X => Y
        addPattern("([^\\-→\\->=>]+?)\\s*(?:→|->|=>)\\s*(.+)", 0.5);
    }

    private static void addPattern(String regex, double confidence) {
        PATTERNS.add(Pattern.compile(regex));
    }

    /**
     * 从一组 chunks 中抽取因果链，按 (cause, effect) 去重。
     */
    public List<ProductModel.CausalLink> extract(List<Document> documents, List<Chunk> chunks) {
        List<ProductModel.CausalLink> links = new ArrayList<>();
        Map<String, ProductModel.CausalLink> dedup = new LinkedHashMap<>();

        for (Chunk c : chunks) {
            String text = c.getContent();
            if (text == null || text.isEmpty()) continue;

            for (int pIdx = 0; pIdx < PATTERNS.size(); pIdx++) {
                Pattern p = PATTERNS.get(pIdx);
                Matcher m = p.matcher(text);
                while (m.find()) {
                    String cause, effect;
                    int gc = m.groupCount();
                    if (gc == 2) {
                        cause = m.group(1).trim();
                        effect = m.group(2).trim();
                    } else if (gc >= 3) {
                        cause = m.group(1).trim();
                        effect = (m.group(2) + " " + m.group(3)).trim();
                    } else continue;

                    cause = sanitize(cause, 80);
                    effect = sanitize(effect, 120);

                    if (cause.length() < 3 || effect.length() < 3) continue;
                    if (cause.equals(effect)) continue;
                    if (looksJunk(cause) || looksJunk(effect)) continue;

                    String key = cause + " → " + effect;
                    if (dedup.containsKey(key)) {
                        ProductModel.CausalLink existing = dedup.get(key);
                        existing.setConfidence(Math.min(0.95, existing.getConfidence() + 0.1));
                    } else {
                        double conf = 0.4 + pIdx * 0.04;
                        ProductModel.CausalLink link = new ProductModel.CausalLink(cause, effect, text);
                        link.setConfidence(conf);
                        link.setRelation(inferRelation(m.group(0)));
                        dedup.put(key, link);
                        links.add(link);
                    }
                }
            }
        }

        // 按置信度降序
        links.sort((a, b) -> Double.compare(b.getConfidence(), a.getConfidence()));
        return links;
    }

    private String sanitize(String s, int maxLen) {
        s = s.replaceAll("[\\r\\n]+", " ").trim();
        if (s.length() > maxLen) s = s.substring(0, maxLen) + "...";
        return s;
    }

    private boolean looksJunk(String s) {
        if (s.matches("^[\\d\\s.,;:!?\\-()（）【】\\[\\]]+$")) return true;
        if (s.length() < 3) return true;
        // 单字比例过高
        long singleChar = s.chars().filter(c -> String.valueOf((char) c).matches("[\\u4e00-\\u9fa5]")).count();
        return singleChar > s.length() * 0.9 && s.length() < 6;
    }

    private String inferRelation(String sentence) {
        String lower = sentence.toLowerCase();
        if (lower.contains("因此") || lower.contains("所以") || lower.contains("因此")
                || lower.contains("thus") || lower.contains("therefore") || lower.contains("leads to")
                || lower.contains("导致") || lower.contains("造成")) {
            return "CAUSES";
        }
        if (lower.contains("从而") || lower.contains("使得") || lower.contains("enables")) {
            return "ENABLES";
        }
        if (lower.contains("为了") || lower.contains("requires")) {
            return "REQUIRES";
        }
        if (lower.contains("→") || lower.contains("->")) {
            return "PRODUCES";
        }
        return "CAUSES";
    }
}