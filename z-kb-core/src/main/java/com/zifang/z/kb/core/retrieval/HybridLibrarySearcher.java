package com.zifang.z.kb.core.retrieval;

import com.zifang.z.kb.core.util.HanLpTokenizer;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 库内混合检索引擎 —— 对「已编译入库的检索块」做向量 / 关键词 / 图谱三路召回并 RRF 融合。
 *
 * <p><b>为什么独立于旧工作台的 {@code HybridSearcher}</b>：旧域的 HybridSearcher 面向
 * {@code ChunkVectorStore} + 内存 BM25 语料 + 进程内图谱，工作区是 workspace 维度；
 * 库内检索面对的是 JDBC 里的检索块表（租户 + 库 + 当前物料版本），
 * 数据面与生命周期都不同。两套实现的召回逻辑一致（向量 + BM25 + 图谱 → RRF），
 * 但取数与过滤口径必须分开，否则「库内检索」会被旧域的 workspace 语义污染。
 * 本类只负责融合算法，不碰存储：调用方负责取候选块与图谱关联。</p>
 *
 * <p><b>RRF 公式</b>：{@code RRF(d) = sum_i( w_i / (k + rank_i(d)) )}，与旧域一致。
 * RRF 只吃 rank 不吃原始分，因此各路量纲不同（余弦 ∈[0,1]、BM25 无上界、图谱为计数）无需归一化。</p>
 *
 * <p><b>为什么图谱路要走「概念 → 块」反查</b>：图谱节点按 materialId + 概念名组织，
 * 边是概念之间的共现关系；召回时先用查询词匹配概念名，再把概念关联的物料版本回连到
 * 具体检索块。只按整句查询去 contains 匹配概念名是行不通的 —— 长句永远匹配不到。</p>
 *
 * <p>本类无状态，可安全共享。</p>
 */
public final class HybridLibrarySearcher {

    /** RRF 平滑常数，与旧域一致。 */
    public static final int DEFAULT_RRF_K = 60;

    /** 召回模式。 */
    public enum Mode {
        /** 只走向量。 */
        DENSE,
        /** 只走 BM25 关键词。 */
        BM25,
        /** 向量 + 关键词两路 RRF。 */
        HYBRID,
        /** 向量 + 关键词 + 图谱三路 RRF。 */
        FUSION;

        /** 宽松解析：空值落到 FUSION，未知值返回 null（由调用方决定是否报错）。 */
        public static Mode parse(String value) {
            if (value == null || value.trim().isEmpty()) {
                return FUSION;
            }
            String trimmed = value.trim().toUpperCase(Locale.ROOT);
            for (Mode mode : values()) {
                if (mode.name().equals(trimmed)) {
                    return mode;
                }
            }
            return null;
        }
    }

    /** 参与检索的候选块。 */
    public static final class Candidate {

        private final String chunkId;
        private final String materialId;
        private final String content;
        private final String heading;
        private final double[] vector;

        public Candidate(String chunkId, String materialId, String content, String heading,
                double[] vector) {
            this.chunkId = chunkId;
            this.materialId = materialId;
            this.content = content;
            this.heading = heading;
            this.vector = vector;
        }

        public String getChunkId() { return chunkId; }
        public String getMaterialId() { return materialId; }
        public String getContent() { return content; }
        public String getHeading() { return heading; }
        public double[] getVector() { return vector; }
    }

    /** 图谱路的一跳关联：概念命中的块。 */
    public static final class GraphHit {

        private final String chunkId;
        private final String conceptName;
        private final int weight;

        public GraphHit(String chunkId, String conceptName, int weight) {
            this.chunkId = chunkId;
            this.conceptName = conceptName;
            this.weight = weight;
        }

        public String getChunkId() { return chunkId; }
        public String getConceptName() { return conceptName; }
        public int getWeight() { return weight; }
    }

    /** 单条命中。 */
    public static final class Hit {

        private final String chunkId;
        private double score;
        private String source;
        private final Map<String, Double> sourceScores;
        private final List<String> matchedTerms;
        private final List<String> matchedEntities;
        private int rank;

        Hit(String chunkId, double score, String source, Map<String, Double> sourceScores,
                List<String> matchedTerms, List<String> matchedEntities) {
            this.chunkId = chunkId;
            this.score = score;
            this.source = source;
            this.sourceScores = sourceScores;
            this.matchedTerms = matchedTerms;
            this.matchedEntities = matchedEntities;
        }

        public String getChunkId() { return chunkId; }
        public double getScore() { return score; }
        public String getSource() { return source; }
        public Map<String, Double> getSourceScores() { return sourceScores; }
        public List<String> getMatchedTerms() { return matchedTerms; }
        public List<String> getMatchedEntities() { return matchedEntities; }
        public int getRank() { return rank; }
        void setRank(int rank) { this.rank = rank; }
    }

    /** 一次检索的结果。 */
    public static final class Result {

        private final List<Hit> hits;
        private final Map<String, Integer> routeCounts;
        private final List<String> degradedRoutes;

        Result(List<Hit> hits, Map<String, Integer> routeCounts, List<String> degradedRoutes) {
            this.hits = hits;
            this.routeCounts = routeCounts;
            this.degradedRoutes = degradedRoutes;
        }

        public List<Hit> getHits() { return hits; }
        public Map<String, Integer> getRouteCounts() { return routeCounts; }
        public List<String> getDegradedRoutes() { return degradedRoutes; }
    }

    /** 各路权重。 */
    public static final class Weights {

        public double vector = 0.5d;
        public double keyword = 0.3d;
        public double graph = 0.2d;

        public Weights() {
        }

        public Weights(double vector, double keyword, double graph) {
            this.vector = vector;
            this.keyword = keyword;
            this.graph = graph;
        }
    }

    private static final double K1 = 1.2d;
    private static final double B = 0.75d;

    private final LocalHashEmbedding embedding;
    private final int rrfK;

    public HybridLibrarySearcher() {
        this(new LocalHashEmbedding(), DEFAULT_RRF_K);
    }

    public HybridLibrarySearcher(LocalHashEmbedding embedding, int rrfK) {
        this.embedding = embedding;
        this.rrfK = rrfK <= 0 ? DEFAULT_RRF_K : rrfK;
    }

    public LocalHashEmbedding embedding() {
        return embedding;
    }

    /**
     * 执行检索。
     *
     * @param mode    召回模式
     * @param query   查询串
     * @param candidates 候选块（调用方已按库 + 当前物料版本过滤）
     * @param graphHits 图谱路命中；mode 不含图谱时可传空列表
     * @param topK    返回条数
     * @param minScore 最低分（对最终 RRF 分生效）
     * @param weights 各路权重
     */
    public Result search(Mode mode, String query, List<Candidate> candidates,
            List<GraphHit> graphHits, int topK, double minScore, Weights weights) {
        List<Hit> hits = new ArrayList<>();
        Map<String, Integer> routeCounts = new LinkedHashMap<>();
        List<String> degraded = new ArrayList<>();
        if (mode == null || query == null || query.trim().isEmpty() || candidates == null
                || candidates.isEmpty()) {
            routeCounts.put("vector", 0);
            routeCounts.put("keyword", 0);
            routeCounts.put("graph", 0);
            return new Result(hits, routeCounts, degraded);
        }
        Weights effective = weights == null ? new Weights() : weights;

        List<Hit> vectorHits = new ArrayList<>();
        List<Hit> keywordHits = new ArrayList<>();
        List<Hit> graphRoute = new ArrayList<>();

        if (mode == Mode.DENSE || mode == Mode.HYBRID || mode == Mode.FUSION) {
            vectorHits = denseRoute(query, candidates, degraded);
        }
        if (mode == Mode.BM25 || mode == Mode.HYBRID || mode == Mode.FUSION) {
            keywordHits = keywordRoute(query, candidates, degraded);
        }
        if (mode == Mode.FUSION) {
            graphRoute = graphRoute(graphHits, degraded);
        }

        routeCounts.put("vector", vectorHits.size());
        routeCounts.put("keyword", keywordHits.size());
        routeCounts.put("graph", graphRoute.size());

        List<Hit> merged;
        switch (mode) {
            case DENSE:
                merged = vectorHits;
                break;
            case BM25:
                merged = keywordHits;
                break;
            case HYBRID:
                merged = rrfMerge(effective.vector, vectorHits, effective.keyword, keywordHits);
                break;
            case FUSION:
            default:
                merged = rrfMerge(effective.vector, vectorHits, effective.keyword, keywordHits,
                        effective.graph, graphRoute);
                break;
        }

        merged.sort(Comparator.comparingDouble(Hit::getScore).reversed()
                .thenComparing(Hit::getChunkId));
        // 融合分归一化：RRF 原始分的量级是 w/(k+rank) ≈ 0.008~0.016，
        // 与 dense 的余弦分（0~1）完全不是一回事。若不归一，
        // 调用方沿用余弦口径的 minScore=0.1 会把命中全部滤光（评测域就踩过这个坑：
        // 坏例从 3 条涨到 7 条、召回率指标直接塌掉）。
        // 归一化后 minScore 在所有模式下语义一致：0~1 的相对分。
        double normalizer = maxScoreOf(mode, effective);
        if (normalizer > 0.0d && mode != Mode.DENSE && mode != Mode.BM25) {
            for (Hit hit : merged) {
                hit.score = hit.score / normalizer;
            }
        }
        List<Hit> kept = new ArrayList<>();
        int rank = 1;
        for (Hit hit : merged) {
            if (kept.size() >= topK) {
                break;
            }
            if (hit.getScore() + 1.0e-9 < minScore) {
                continue;
            }
            hit.setRank(rank++);
            kept.add(hit);
        }
        return new Result(kept, routeCounts, degraded);
    }

    /**
     * 该模式下「同一个块被所有路都排在首位」时的理论最大融合分，用作归一化分母。
     *
     * <p>各路首位贡献 {@code w_i/(k+1)}，求和即最大可能分。
     * 图谱路权重再高也不会超过这个上界，因此归一化后得分落在 0~1。</p>
     */
    private double maxScoreOf(Mode mode, Weights weights) {
        double max = 0.0d;
        if (mode == Mode.DENSE || mode == Mode.HYBRID || mode == Mode.FUSION) {
            max += weights.vector;
        }
        if (mode == Mode.BM25 || mode == Mode.HYBRID || mode == Mode.FUSION) {
            max += weights.keyword;
        }
        if (mode == Mode.FUSION) {
            max += weights.graph;
        }
        return max / (rrfK + 1);
    }

    /** 向量路：余弦相似度降序。 */
    private List<Hit> denseRoute(String query, List<Candidate> candidates,
            List<String> degraded) {
        List<Hit> hits = new ArrayList<>();
        try {
            double[] queryVector = embedding.embed(query);
            for (Candidate candidate : candidates) {
                double[] vector = candidate.getVector();
                if (vector == null || vector.length == 0) {
                    vector = embedding.embed(candidate.getContent());
                }
                double score = Math.max(0.0d, embedding.cosine(queryVector, vector));
                if (score <= 0.0d) {
                    continue;
                }
                hits.add(new Hit(candidate.getChunkId(), score, "vector",
                        Collections.singletonMap("vector", score),
                        matchedTerms(query, candidate), Collections.emptyList()));
            }
            hits.sort(Comparator.comparingDouble(Hit::getScore).reversed()
                    .thenComparing(Hit::getChunkId));
        } catch (Exception e) {
            degraded.add("vector: " + e.getMessage());
        }
        return hits;
    }

    /** 关键词路：BM25 打分。 */
    private List<Hit> keywordRoute(String query, List<Candidate> candidates,
            List<String> degraded) {
        List<Hit> hits = new ArrayList<>();
        try {
            List<String> terms = HanLpTokenizer.tokenize(query);
            if (terms.isEmpty()) {
                return hits;
            }
            int n = candidates.size();
            Map<String, Integer> docFreq = new LinkedHashMap<>();
            List<Map<String, Integer>> termFreqs = new ArrayList<>();
            List<Integer> lengths = new ArrayList<>();
            long totalChars = 0L;
            for (Candidate candidate : candidates) {
                String text = (candidate.getHeading() == null ? "" : candidate.getHeading())
                        + "\n" + (candidate.getContent() == null ? "" : candidate.getContent());
                Map<String, Integer> tf = new LinkedHashMap<>();
                for (String term : HanLpTokenizer.tokenize(text)) {
                    tf.merge(term, 1, Integer::sum);
                }
                termFreqs.add(tf);
                lengths.add(text.length());
                totalChars += text.length();
                for (String term : tf.keySet()) {
                    docFreq.merge(term, 1, Integer::sum);
                }
            }
            double avgDl = n == 0 ? 1.0d : (double) totalChars / n;
            if (avgDl <= 0.0d) {
                avgDl = 1.0d;
            }
            for (int i = 0; i < candidates.size(); i++) {
                Map<String, Integer> tf = termFreqs.get(i);
                int dl = lengths.get(i);
                double score = 0.0d;
                List<String> matched = new ArrayList<>();
                for (String term : terms) {
                    int f = tf.getOrDefault(term, 0);
                    if (f == 0) {
                        continue;
                    }
                    int df = docFreq.getOrDefault(term, 0);
                    double idf = Math.log(1.0d + (n - df + 0.5d) / (df + 0.5d));
                    double tfNorm = (f * (K1 + 1.0d)) / (f + K1 * (1.0d - B + B * dl / avgDl));
                    score += idf * tfNorm;
                    if (!matched.contains(term)) {
                        matched.add(term);
                    }
                }
                if (score <= 0.0d) {
                    continue;
                }
                hits.add(new Hit(candidates.get(i).getChunkId(), score, "keyword",
                        Collections.singletonMap("keyword", score), matched,
                        Collections.emptyList()));
            }
            hits.sort(Comparator.comparingDouble(Hit::getScore).reversed()
                    .thenComparing(Hit::getChunkId));
        } catch (Exception e) {
            degraded.add("keyword: " + e.getMessage());
        }
        return hits;
    }

    /** 图谱路：按权重（概念关联强度）排序。 */
    private List<Hit> graphRoute(List<GraphHit> graphHits, List<String> degraded) {
        List<Hit> hits = new ArrayList<>();
        try {
            if (graphHits == null || graphHits.isEmpty()) {
                return hits;
            }
            Map<String, GraphHit> best = new LinkedHashMap<>();
            for (GraphHit graphHit : graphHits) {
                if (graphHit.getChunkId() == null) {
                    continue;
                }
                best.merge(graphHit.getChunkId(), graphHit, (left, right) ->
                        left.getWeight() >= right.getWeight() ? left : right);
            }
            for (Map.Entry<String, GraphHit> entry : best.entrySet()) {
                GraphHit graphHit = entry.getValue();
                hits.add(new Hit(entry.getKey(), graphHit.getWeight(), "graph",
                        Collections.singletonMap("graph", (double) graphHit.getWeight()),
                        Collections.emptyList(),
                        Collections.singletonList(graphHit.getConceptName())));
            }
            hits.sort(Comparator.comparingDouble(Hit::getScore).reversed()
                    .thenComparing(Hit::getChunkId));
        } catch (Exception e) {
            degraded.add("graph: " + e.getMessage());
        }
        return hits;
    }

    /**
     * RRF 融合两路。
     *
     * <p>同一块被多路召回时分数累加；命中词与命中实体取并集，
     * 否则融合后调用方看不到「这条为什么被召回」。</p>
     */
    private List<Hit> rrfMerge(double vectorWeight, List<Hit> vectorHits,
            double keywordWeight, List<Hit> keywordHits) {
        List<Route> routes = new ArrayList<>();
        routes.add(new Route(vectorWeight, vectorHits));
        routes.add(new Route(keywordWeight, keywordHits));
        return rrfMerge(routes);
    }

    /** RRF 融合三路。 */
    private List<Hit> rrfMerge(double vectorWeight, List<Hit> vectorHits,
            double keywordWeight, List<Hit> keywordHits,
            double graphWeight, List<Hit> graphHits) {
        List<Route> routes = new ArrayList<>();
        routes.add(new Route(vectorWeight, vectorHits));
        routes.add(new Route(keywordWeight, keywordHits));
        routes.add(new Route(graphWeight, graphHits));
        return rrfMerge(routes);
    }

    private List<Hit> rrfMerge(List<Route> routes) {
        Map<String, Double> scoreMap = new LinkedHashMap<>();
        Map<String, Hit> hitMap = new LinkedHashMap<>();
        for (Route route : routes) {
            for (int rank = 0; rank < route.hits.size(); rank++) {
                Hit incoming = route.hits.get(rank);
                double rrfScore = route.weight / (rrfK + rank + 1);
                scoreMap.merge(incoming.getChunkId(), rrfScore, Double::sum);
                Hit kept = hitMap.get(incoming.getChunkId());
                if (kept == null) {
                    kept = new Hit(incoming.getChunkId(), 0.0d, incoming.getSource(),
                            new LinkedHashMap<>(), new ArrayList<>(incoming.getMatchedTerms()),
                            new ArrayList<>(incoming.getMatchedEntities()));
                    hitMap.put(incoming.getChunkId(), kept);
                }
                kept.getSourceScores().merge(incoming.getSource(), rrfScore, Double::sum);
                for (String term : incoming.getMatchedTerms()) {
                    if (!kept.getMatchedTerms().contains(term)) {
                        kept.getMatchedTerms().add(term);
                    }
                }
                for (String entity : incoming.getMatchedEntities()) {
                    if (!kept.getMatchedEntities().contains(entity)) {
                        kept.getMatchedEntities().add(entity);
                    }
                }
            }
        }
        List<Hit> result = new ArrayList<>();
        for (Map.Entry<String, Double> entry : scoreMap.entrySet()) {
            Hit hit = hitMap.get(entry.getKey());
            hit.score = entry.getValue();
            hit.source = "fusion";
            result.add(hit);
        }
        return result;
    }

    /** 一路召回与其权重。 */
    private static final class Route {

        private final double weight;
        private final List<Hit> hits;

        Route(double weight, List<Hit> hits) {
            this.weight = weight;
            this.hits = hits == null ? Collections.emptyList() : hits;
        }
    }

    /** 查询词在候选块正文/标题中的直接命中片段（供解释与命中词展示）。 */
    private List<String> matchedTerms(String query, Candidate candidate) {
        List<String> matched = new ArrayList<>();
        String text = (candidate.getHeading() == null ? "" : candidate.getHeading())
                + "\n" + (candidate.getContent() == null ? "" : candidate.getContent());
        String lower = text.toLowerCase(Locale.ROOT);
        for (String term : HanLpTokenizer.tokenize(query)) {
            if (lower.contains(term.toLowerCase(Locale.ROOT)) && !matched.contains(term)) {
                matched.add(term);
            }
        }
        return matched;
    }
}
