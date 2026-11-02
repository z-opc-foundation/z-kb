package com.zifang.z.kb.core.retrieval;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 本地确定性向量：中文二元组与英文单词做特征哈希后 L2 归一化。
 *
 * <p>只用于本地 dense 召回链路，不代表生产嵌入模型；模型标识随块写入，
 * 切换实现后按标识重建即可。</p>
 */
public class LocalHashEmbedding {

    public static final String MODEL = "local-hash-ngram-v1";

    private static final int DIMENSION = 384;

    private static final int MAX_TERMS = 5;

    public String model() {
        return MODEL;
    }

    /** 分词后按词频加权特征哈希到 384 维，并做 L2 归一化（空文本返回零向量）。 */
    public double[] embed(String text) {
        double[] vector = new double[DIMENSION];
        Map<String, Integer> frequencies = new HashMap<>();
        for (String token : tokenize(text)) {
            frequencies.merge(token, 1, Integer::sum);
        }
        for (Map.Entry<String, Integer> entry : frequencies.entrySet()) {
            double weight = 1.0d + Math.log(entry.getValue());
            int hash = fnv1a(entry.getKey());
            int index = Math.floorMod(hash, DIMENSION);
            int sign = ((hash >>> 16) & 1) == 0 ? 1 : -1;
            vector[index] += sign * weight;
        }
        double norm = 0.0d;
        for (double value : vector) {
            norm += value * value;
        }
        if (norm > 0.0d) {
            double root = Math.sqrt(norm);
            for (int i = 0; i < vector.length; i++) {
                vector[i] = vector[i] / root;
            }
        }
        return vector;
    }

    /** 将向量按 6 位小数逗号拼接为字符串，空向量返回 null。 */
    public String encode(double[] vector) {
        if (vector == null || vector.length == 0) {
            return null;
        }
        StringBuilder builder = new StringBuilder(vector.length * 8);
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(String.format(Locale.ROOT, "%.6f", vector[i]));
        }
        return builder.toString();
    }

    /** 将逗号分隔的向量字符串还原为数组，内容为空或含非法数字时返回 null。 */
    public double[] decode(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        String[] parts = text.split(",");
        double[] vector = new double[parts.length];
        try {
            for (int i = 0; i < parts.length; i++) {
                vector[i] = Double.parseDouble(parts[i]);
            }
        } catch (NumberFormatException e) {
            return null;
        }
        return vector;
    }

    /** 计算两个等长向量的余弦相似度并截断到 [-1,1]；入参为空、长度不等或零向量时返回 0。 */
    public double cosine(double[] left, double[] right) {
        if (left == null || right == null || left.length != right.length) {
            return 0.0d;
        }
        double dot = 0.0d;
        double leftNorm = 0.0d;
        double rightNorm = 0.0d;
        for (int i = 0; i < left.length; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        if (leftNorm == 0.0d || rightNorm == 0.0d) {
            return 0.0d;
        }
        double value = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
        return Math.max(-1.0d, Math.min(1.0d, value));
    }

    /** 返回查询文本按分词顺序去重后的前 5 个多字符词项，用于命中解释。 */
    public List<String> queryTerms(String text) {
        Set<String> terms = new LinkedHashSet<>();
        for (String token : tokenize(text)) {
            if (token.length() > 1) {
                terms.add(token);
            }
            if (terms.size() >= MAX_TERMS) {
                break;
            }
        }
        return new ArrayList<>(terms);
    }

    /** 将文本转小写后切分为词项：连续汉字拆为二元组，连续字母数字保留为单词。 */
    private List<String> tokenize(String text) {
        List<String> tokens = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return tokens;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        StringBuilder han = new StringBuilder();
        StringBuilder word = new StringBuilder();
        for (int i = 0; i < lower.length(); i++) {
            char current = lower.charAt(i);
            if (isHan(current)) {
                flushWord(word, tokens);
                han.append(current);
            } else if (Character.isLetterOrDigit(current)) {
                flushHan(han, tokens);
                word.append(current);
            } else {
                flushHan(han, tokens);
                flushWord(word, tokens);
            }
        }
        flushHan(han, tokens);
        flushWord(word, tokens);
        return tokens;
    }

    private boolean isHan(char value) {
        return Character.UnicodeScript.of(value) == Character.UnicodeScript.HAN;
    }

    /** 汉字片段：单字直接成词，多字按相邻二元组切分。 */
    private void flushHan(StringBuilder han, List<String> tokens) {
        if (han.length() == 0) {
            return;
        }
        String run = han.toString();
        if (run.length() == 1) {
            tokens.add(run);
        } else {
            for (int i = 0; i + 1 < run.length(); i++) {
                tokens.add(run.substring(i, i + 2));
            }
        }
        han.setLength(0);
    }

    /** 英文单词（长度至少 2）出栈。 */
    private void flushWord(StringBuilder word, List<String> tokens) {
        if (word.length() >= 2) {
            tokens.add(word.toString());
        }
        word.setLength(0);
    }

    /** 词项的 FNV-1a 32 位哈希，用于映射到向量维度与符号位。 */
    private int fnv1a(String token) {
        int hash = 0x811c9dc5;
        for (int i = 0; i < token.length(); i++) {
            hash ^= token.charAt(i);
            hash *= 0x01000193;
        }
        return hash;
    }
}
