package com.zifang.z.kb.core.extractor;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.Relation;
import com.zifang.z.kb.api.RelationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 关系抽取器 — 基于共现窗口 + 关键词触发的轻量关系抽取。
 *
 * <p>策略：
 * <ol>
 *   <li>同一 chunk 中出现的实体对，建立 RELATED_TO 关系</li>
 *   <li>基于关键词触发推断更具体的关系类型：
 *      <ul>
 *        <li>"使用" / "基于" → USES</li>
 *        <li>"包含" / "组成" → CONTAINS</li>
 *        <li>"属于" / "分类" → BELONGS_TO</li>
 *        <li>"对比" / "比较" → COMPARED_TO</li>
 *        <li>"替代" / "取代" → REPLACES</li>
 *        <li>"类似" / "相似" → SIMILAR_TO</li>
 *      </ul>
 *   </li>
 *   <li>相邻句子窗口内提取证据（evidence sentence）</li>
 * </ol>
 */
public class RelationExtractor {

    private static final Logger log = LoggerFactory.getLogger(RelationExtractor.class);

    private static final Pattern SENTENCE_SPLIT = Pattern.compile("[。！？!?\\n]+");

    private static final Map<String, String> KEYWORD_TYPE_MAP = new LinkedHashMap<>();
    static {
        KEYWORD_TYPE_MAP.put("使用", RelationType.USES.name());
        KEYWORD_TYPE_MAP.put("基于", RelationType.USES.name());
        KEYWORD_TYPE_MAP.put("采用", RelationType.USES.name());
        KEYWORD_TYPE_MAP.put("依赖", RelationType.REQUIRES.name());
        KEYWORD_TYPE_MAP.put("需要", RelationType.REQUIRES.name());
        KEYWORD_TYPE_MAP.put("包含", RelationType.CONTAINS.name());
        KEYWORD_TYPE_MAP.put("由...组成", RelationType.CONTAINS.name());
        KEYWORD_TYPE_MAP.put("属于", RelationType.BELONGS_TO.name());
        KEYWORD_TYPE_MAP.put("归属于", RelationType.BELONGS_TO.name());
        KEYWORD_TYPE_MAP.put("分类", RelationType.BELONGS_TO.name());
        KEYWORD_TYPE_MAP.put("对比", RelationType.COMPARED_TO.name());
        KEYWORD_TYPE_MAP.put("比较", RelationType.COMPARED_TO.name());
        KEYWORD_TYPE_MAP.put("类似", RelationType.SIMILAR_TO.name());
        KEYWORD_TYPE_MAP.put("相似", RelationType.SIMILAR_TO.name());
        KEYWORD_TYPE_MAP.put("替代", RelationType.REPLACES.name());
        KEYWORD_TYPE_MAP.put("取代", RelationType.REPLACES.name());
        KEYWORD_TYPE_MAP.put("实现", RelationType.IMPLEMENTS.name());
        KEYWORD_TYPE_MAP.put("扩展", RelationType.EXTENDS.name());
    }

    /**
     * 从 chunk + 该 chunk 的实体集合中抽取关系。
     */
    public List<Relation> extract(Chunk chunk, List<Entity> entities) {
        if (chunk == null || chunk.getContent() == null || entities == null || entities.size() < 2) {
            return new ArrayList<>();
        }
        if (entities.size() > 30) {
            // 实体过多时跳过（避免关系爆炸）
            return new ArrayList<>();
        }

        String content = chunk.getContent();
        String[] sentences = SENTENCE_SPLIT.split(content);

        // 用 Map 去重（source + target + type 三元组）
        Map<String, Relation> relationMap = new LinkedHashMap<>();
        int windowSize = 2; // 邻近 2 个句子

        for (int i = 0; i < sentences.length; i++) {
            String window = String.join("。", java.util.Arrays.copyOfRange(
                    sentences, Math.max(0, i - windowSize), Math.min(sentences.length, i + windowSize + 1)));
            // 在 window 中找出出现的实体
            List<Entity> present = new ArrayList<>();
            for (Entity e : entities) {
                if (containsWord(window, e.getCanonicalName())) {
                    present.add(e);
                }
            }
            // 两两组合 + 推断关系类型
            for (int a = 0; a < present.size(); a++) {
                for (int b = a + 1; b < present.size(); b++) {
                    Entity eA = present.get(a);
                    Entity eB = present.get(b);
                    String type = inferType(window);
                    addRelation(relationMap, eA, eB, type, chunk, window);
                }
            }
        }
        return new ArrayList<>(relationMap.values());
    }

    private void addRelation(Map<String, Relation> map, Entity from, Entity to, String type,
                              Chunk chunk, String evidence) {
        String key = from.getCanonicalName() + "|" + to.getCanonicalName() + "|" + type;
        Relation r = map.get(key);
        if (r == null) {
            r = new Relation(from.getCanonicalName(), type, to.getCanonicalName());
            r.setWorkspace(chunk.getWorkspace());
            r.setEvidenceChunkIds(new ArrayList<>());
            r.setEvidenceSentences(new ArrayList<>());
            map.put(key, r);
        }
        if (!r.getEvidenceChunkIds().contains(chunk.getId())) {
            r.getEvidenceChunkIds().add(chunk.getId());
            r.setFrequency(r.getFrequency() + 1);
            r.setWeight(Math.min(1.0, 0.5 + r.getFrequency() * 0.1));
        }
        if (evidence != null && !evidence.isEmpty() && r.getEvidenceSentences().size() < 3) {
            String trimmed = evidence.length() > 200 ? evidence.substring(0, 200) : evidence;
            r.getEvidenceSentences().add(trimmed);
        }
    }

    /** 基于关键词推断关系类型 */
    private String inferType(String text) {
        for (Map.Entry<String, String> e : KEYWORD_TYPE_MAP.entrySet()) {
            if (text.contains(e.getKey())) {
                return e.getValue();
            }
        }
        return RelationType.RELATED_TO.name();
    }

    /** 简单包含判断（区分大小写英文 + 中文子串） */
    private boolean containsWord(String text, String word) {
        if (text == null || word == null || word.isEmpty()) return false;
        return text.contains(word);
    }
}
