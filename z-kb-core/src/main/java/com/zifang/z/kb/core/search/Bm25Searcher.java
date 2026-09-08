package com.zifang.z.kb.core.search;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.core.util.HanLpTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * BM25 全文检索器 — 基于 HanLP 分词 + BM25 打分。
 *
 * <p>支持：
 * <ul>
 *   <li>动态语料（addChunk 后立即可搜）</li>
 *   <li>多 workspace 隔离</li>
 *   <li>标签过滤</li>
 * </ul>
 *
 * <p>局限：仅 in-memory；大规模数据需迁移到 Elasticsearch / OpenSearch。
 */
public class Bm25Searcher {

    private static final Logger log = LoggerFactory.getLogger(Bm25Searcher.class);

    /** BM25 参数（Lucene 默认） */
    private static final double K1 = 1.2;
    private static final double B = 0.75;

    /** workspace → corpus */
    private final Map<String, Corpus> corpora = new HashMap<>();

    /**
     * 添加 chunk 到工作台的语料。
     */
    public synchronized void addChunk(Chunk chunk) {
        if (chunk == null || chunk.getWorkspace() == null) return;
        Corpus corpus = corpora.computeIfAbsent(chunk.getWorkspace(), k -> new Corpus());
        corpus.addChunk(chunk);
    }

    /** 批量添加 */
    public synchronized void addChunks(List<Chunk> chunks) {
        if (chunks == null) return;
        for (Chunk c : chunks) addChunk(c);
    }

    /** 从语料中删除某文档的全部 chunk */
    public synchronized void deleteByDocument(String workspace, String documentId) {
        Corpus corpus = corpora.get(workspace);
        if (corpus != null) corpus.deleteByDocument(documentId);
    }

    /** 清空工作台 */
    public synchronized void clear(String workspace) {
        corpora.remove(workspace);
    }

    /**
     * 检索。
     *
     * @return 命中的 SearchHit 列表（按 BM25 score 降序）
     */
    public List<SearchHit> search(SearchQuery q) {
        Corpus corpus = corpora.get(q.getWorkspace());
        if (corpus == null || corpus.chunks.isEmpty()) return new ArrayList<>();

        List<String> queryTerms = HanLpTokenizer.tokenize(q.getQuery());
        if (queryTerms.isEmpty()) return new ArrayList<>();

        // BM25 评分
        List<ScoredChunk> scored = new ArrayList<>();
        int N = corpus.chunks.size();
        double avgDl = corpus.averageLength;

        for (int i = 0; i < corpus.chunks.size(); i++) {
            Chunk chunk = corpus.chunks.get(i);
            Map<String, Integer> tf = corpus.termFreqs.get(i);
            int dl = chunk.getContent() != null ? chunk.getContent().length() : 0;

            double score = 0.0;
            for (String term : queryTerms) {
                int f = tf.getOrDefault(term, 0);
                if (f == 0) continue;
                int df = corpus.docFreq.getOrDefault(term, 0);
                double idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
                double tfNorm = (f * (K1 + 1)) / (f + K1 * (1 - B + B * dl / avgDl));
                score += idf * tfNorm;
            }

            // 标签过滤
            if (q.getTags() != null && !q.getTags().isEmpty()) {
                List<String> docTags = chunk.getMeta() != null && chunk.getMeta().get("tags") instanceof List
                        ? (List<String>) chunk.getMeta().get("tags") : Collections.emptyList();
                boolean match = q.getTags().stream().anyMatch(docTags::contains);
                if (!match) continue;
            }
            if (score > 0) {
                scored.add(new ScoredChunk(i, score));
            }
        }

        // 排序 + 取 topK
        scored.sort((a, b) -> Double.compare(b.score, a.score));
        List<SearchHit> hits = new ArrayList<>();
        int limit = Math.min(scored.size(), q.getTopK());
        for (int i = 0; i < limit; i++) {
            ScoredChunk sc = scored.get(i);
            Chunk chunk = corpus.chunks.get(sc.idx);
            SearchHit hit = SearchHit.builder()
                    .chunkId(chunk.getId())
                    .documentId(chunk.getDocumentId())
                    .content(q.isIncludeContent() ? chunk.getContent() : null)
                    .contextTitle(chunk.getContextTitle())
                    .headingPath(chunk.getHeadingPath())
                    .score(sc.score)
                    .source("keyword")
                    .ordinal(chunk.getOrdinal())
                    .build();
            hits.add(hit);
        }
        return hits;
    }

    /** 语料库 */
    private static class Corpus {
        final List<Chunk> chunks = new ArrayList<>();
        final List<Map<String, Integer>> termFreqs = new ArrayList<>();
        final Map<String, Integer> docFreq = new HashMap<>();
        double averageLength = 0;
        long totalChars = 0;

        void addChunk(Chunk chunk) {
            int idx = chunks.size();
            chunks.add(chunk);
            List<String> terms = HanLpTokenizer.tokenize(chunk.getContent());
            Map<String, Integer> tf = new HashMap<>();
            Set<String> seen = new HashSet<>();
            for (String t : terms) {
                tf.merge(t, 1, Integer::sum);
                if (seen.add(t)) {
                    docFreq.merge(t, 1, Integer::sum);
                }
            }
            termFreqs.add(tf);
            totalChars += chunk.getContent() != null ? chunk.getContent().length() : 0;
            averageLength = chunks.isEmpty() ? 0 : (double) totalChars / chunks.size();
        }

        void deleteByDocument(String documentId) {
            for (int i = chunks.size() - 1; i >= 0; i--) {
                if (documentId.equals(chunks.get(i).getDocumentId())) {
                    chunks.remove(i);
                    termFreqs.remove(i);
                    // 简化：docFreq 不严格减（影响很小，可定期 rebuild）
                }
            }
            totalChars = 0;
            for (Chunk c : chunks) {
                totalChars += c.getContent() != null ? c.getContent().length() : 0;
            }
            averageLength = chunks.isEmpty() ? 0 : (double) totalChars / chunks.size();
        }
    }

    private static class ScoredChunk {
        final int idx;
        final double score;
        ScoredChunk(int idx, double score) { this.idx = idx; this.score = score; }
    }
}
