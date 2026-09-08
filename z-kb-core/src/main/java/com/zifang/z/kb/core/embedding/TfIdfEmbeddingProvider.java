package com.zifang.z.kb.core.embedding;

import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.core.util.HanLpTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * TF-IDF Embedding 提供者 — 离线自包含实现。
 *
 * <p>原理：
 * <ul>
 *   <li>分词：HanLP 中文分词 + 英文/数字/驼峰拆分</li>
 *   <li>特征：term + char-ngram（默认 3-gram）</li>
 *   <li>向量化：固定维度（默认 512），通过 MurmurHash3 映射到槽位，权重为 TF-IDF</li>
 *   <li>归一化：L2 归一，便于 COSINE 距离</li>
 * </ul>
 *
 * <p>特点：
 * <ul>
 *   <li>零外部依赖：不需要 LLM API Key</li>
 *   <li>轻量：百 KB 内存即可启动</li>
 *   <li>可解释：每个维度对应一个 hash bucket，便于调试</li>
 * </ul>
 *
 * <p>局限：
 * <ul>
 *   <li>无语义理解（"数据库" 和 "DB" 不会相似）</li>
 *   <li>需要足够的训练语料才能学到有用的 IDF</li>
 * </ul>
 *
 * <p>生产建议：仅用作离线 fallback，主流程应使用 {@link HttpEmbeddingProvider} 调用真 Embedding API。
 */
public class TfIdfEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(TfIdfEmbeddingProvider.class);

    private static final Pattern WORD_PATTERN = Pattern.compile("[\\w\\u4e00-\\u9fff]+");
    private static final int DEFAULT_NGRAM = 3;

    private final int dimension;
    private final int ngramSize;

    /** term → doc frequency */
    private final ConcurrentHashMap<String, Integer> df = new ConcurrentHashMap<>();
    /** 已处理文档数 */
    private int totalDocs = 0;

    public TfIdfEmbeddingProvider() {
        this(512, DEFAULT_NGRAM);
    }

    public TfIdfEmbeddingProvider(int dimension) {
        this(dimension, DEFAULT_NGRAM);
    }

    public TfIdfEmbeddingProvider(int dimension, int ngramSize) {
        this.dimension = dimension;
        this.ngramSize = ngramSize;
    }

    @Override
    public float[] embed(String text) {
        return embedInternal(text, true);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        List<float[]> result = new ArrayList<>(texts.size());
        for (String t : texts) result.add(embedInternal(t, true));
        return result;
    }

    @Override
    public int dimension() { return dimension; }

    @Override
    public String providerName() { return "tfidf-local"; }

    /**
     * 训练 IDF（可选 — 不训练也能用，只是 IDF=1）。
     */
    public void trainIdf(List<String> corpus) {
        for (String doc : corpus) {
            trainOneDoc(doc);
        }
        log.info("TfIdfEmbeddingProvider trained: {} docs, {} unique terms", totalDocs, df.size());
    }

    /** 训练单文档：更新 DF */
    public void trainOneDoc(String text) {
        if (text == null || text.isEmpty()) return;
        List<String> terms = tokenize(text);
        java.util.Set<String> unique = new java.util.LinkedHashSet<>(terms);
        for (String t : unique) {
            df.merge(t, 1, Integer::sum);
        }
        // 加入字符 ngram
        for (String t : unique) {
            for (String ng : charNgrams(t, ngramSize)) {
                df.merge(ng, 1, Integer::sum);
            }
        }
        totalDocs++;
    }

    private float[] embedInternal(String text, boolean updateStats) {
        if (text == null || text.isEmpty()) {
            return new float[dimension];
        }
        List<String> terms = tokenize(text);
        if (updateStats && totalDocs == 0) {
            // 第一次使用，自训练（用单文档近似）
            trainOneDoc(text);
        }

        Map<Integer, Float> vec = new HashMap<>();
        // term frequency
        Map<String, Integer> tfMap = new HashMap<>();
        for (String t : terms) {
            tfMap.merge(t, 1, Integer::sum);
        }
        for (String t : terms) {
            for (String feat : featuresOf(t)) {
                int slot = Math.floorMod(feat.hashCode(), dimension);
                float weight = tfidf(feat, tfMap.get(t));
                vec.merge(slot, weight, Float::sum);
            }
        }
        // 转为数组并 L2 归一
        float[] result = new float[dimension];
        float norm = 0f;
        for (float v : vec.values()) norm += v * v;
        norm = (float) Math.sqrt(norm);
        if (norm > 0) {
            for (Map.Entry<Integer, Float> e : vec.entrySet()) {
                result[e.getKey()] = e.getValue() / norm;
            }
        }
        return result;
    }

    /** 特征：term 本身 + 字符 ngram */
    private List<String> featuresOf(String term) {
        List<String> feats = new ArrayList<>();
        feats.add(term);
        feats.addAll(charNgrams(term, ngramSize));
        return feats;
    }

    private float tfidf(String feat, int tf) {
        double idf = Math.log((1.0 + totalDocs) / (1.0 + df.getOrDefault(feat, 0))) + 1.0;
        return (float) (tf * idf);
    }

    /** HanLP 分词 */
    private List<String> tokenize(String text) {
        try {
            return HanLpTokenizer.tokenize(text);
        } catch (Throwable t) {
            // fallback: 按非 word 字符切
            return WORD_PATTERN.matcher(text).results()
                    .map(m -> m.group().toLowerCase(Locale.ROOT))
                    .collect(Collectors.toList());
        }
    }

    private static List<String> charNgrams(String s, int n) {
        List<String> ngrams = new ArrayList<>();
        if (s.length() < n) {
            ngrams.add(s);
            return ngrams;
        }
        for (int i = 0; i <= s.length() - n; i++) {
            ngrams.add(s.substring(i, i + n));
        }
        return ngrams;
    }
}
