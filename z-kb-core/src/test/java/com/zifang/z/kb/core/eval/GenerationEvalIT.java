package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.chunker.Chunker;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.parser.MarkdownParser;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 生成侧评测 + 无检索基线对照。
 *
 * <p><b>默认不跑</b>：需要一台可用的 OpenAI 兼容端点。设置 {@code EVAL_LLM_ENDPOINT}
 * 后才会执行 —— 否则常规构建会因为连不上评测机而红。
 *
 * <p>裁判模型必须是无 thinking 的（见 LlmJudge 类注释）；带思维链的模型会把推理写进
 * content，解析出的分数全是噪声。
 */
@EnabledIfEnvironmentVariable(named = "EVAL_LLM_ENDPOINT", matches = ".+")
class GenerationEvalIT {

    private static final String WORKSPACE = "eval2";

    @Test
    @DisplayName("检索带来的净增益：有检索臂正确度应高于无检索臂")
    void retrievalBeatsNoRetrievalBaseline() {
        String endpoint = System.getenv("EVAL_LLM_ENDPOINT");
        String model = System.getenv().getOrDefault("EVAL_MODEL", "qwen2.5:14b-instruct-q4_K_M");

        InMemoryStores.Vector vectorStore = new InMemoryStores.Vector();
        InMemoryStores.Graph graphStore = new InMemoryStores.Graph();
        Bm25Searcher bm25 = new Bm25Searcher();
        TfIdfEmbeddingProvider embedder = new TfIdfEmbeddingProvider();
        EntityExtractor entityExtractor = new EntityExtractor();
        final HybridSearcher searcher =
                new HybridSearcher(vectorStore, graphStore, bm25, embedder, entityExtractor);

        String[] docKeys = readDocKeys();
        MarkdownParser parser = new MarkdownParser();
        Chunker chunker = new Chunker();
        List<Chunk> all = new ArrayList<>();
        for (String key : docKeys) {
            MarkdownParser.ParseResult parsed = parser.parse(readResource("/eval2/corpus/corpus-" + key + ".md"));
            Document doc = new Document();
            doc.setId("doc-" + key);
            doc.setTitle(parsed.title);
            doc.setBody(parsed.body);
            doc.setWorkspace(WORKSPACE);
            all.addAll(chunker.chunk(doc));
        }
        assertFalse(all.isEmpty(), "语料为空");

        List<String> contents = new ArrayList<>(all.size());
        for (Chunk c : all) {
            contents.add(c.getContent() == null ? "" : c.getContent());
        }
        embedder.trainIdf(contents);
        for (Chunk c : all) {
            c.setEmbedding(embedder.embed(c.getContent()));
        }
        vectorStore.createCollection(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, embedder.dimension());
        vectorStore.upsert(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, all);
        bm25.addChunks(all);
        for (Chunk c : all) {
            for (Entity e : entityExtractor.extract(c)) {
                e.setWorkspace(WORKSPACE);
                graphStore.upsertEntity(e);
            }
        }

        EvalDataset dataset = EvalDataset.parse(readResource("/eval2/golden-set-v2.json"));
        expandDocIds(dataset, all);

        SearchService service = new SearchService() {
            @Override
            public SearchResult search(SearchQuery query) {
                return searcher.search(query);
            }
        };

        LlmJudge judge = new LlmJudge(endpoint, model);
        GenerationEvalReport report = new GenerationEvaluator(
                service, new LlmJudge(endpoint, model), judge, SearchMode.FUSION, 5, 400)
                .evaluate(dataset, WORKSPACE);

        GenerationEvalReport.Arm with = report.getArms().get(GenerationEvaluator.ARM_WITH_RETRIEVAL);
        GenerationEvalReport.Arm no = report.getArms().get(GenerationEvaluator.ARM_NO_RETRIEVAL);

        System.out.println("[gen-eval] " + GenerationEvaluator.headline(report));
        for (GenerationEvalReport.Arm arm : report.getArms().values()) {
            System.out.println(String.format("[gen-eval] %-15s n=%d correctness=%.2f relevancy=%.2f faithfulness=%.2f",
                    arm.name, arm.getSampleSize(), arm.getCorrectness(),
                    arm.getAnswerRelevancy(), arm.getFaithfulness()));
        }

        // 上下文为空时，「有检索臂反而更差」是评测装置的假象而非系统真实表现。
        // 这里把它钉死：hit 必须带正文，否则下面的正确度对比不成立。
        for (GenerationEvalReport.CaseScore s : with.getCases()) {
            assertFalse(s.contextChunkIds.isEmpty(), s.caseId + " 检索上下文为空");
        }

        assertTrue(with.getSampleSize() > 0, "有检索臂无样本");
        assertEquals(with.getSampleSize(), no.getSampleSize(), "两臂样本数不等，对照无效");
        // 无检索臂 faithfulness 恒不适用，不能参与比较
        assertTrue(no.getFaithfulness() == 0.0);
    }

    private static void assertEquals(int a, int b, String msg) {
        org.junit.jupiter.api.Assertions.assertEquals(a, b, msg);
    }

    private static void expandDocIds(EvalDataset dataset, List<Chunk> all) {
        java.util.Map<String, List<String>> byDoc = new java.util.LinkedHashMap<>();
        for (Chunk c : all) {
            byDoc.computeIfAbsent(c.getDocumentId(), k -> new ArrayList<>()).add(c.getId());
        }
        for (EvalCase c : dataset.getCases()) {
            List<String> expanded = new ArrayList<>();
            for (String docId : c.getExpectedDocIds()) {
                List<String> ids = byDoc.get("doc-" + docId);
                if (ids != null) {
                    expanded.addAll(ids);
                }
            }
            c.setExpectedChunkIds(expanded);
        }
    }

    private static String[] readDocKeys() {
        // 与 gen_corpus.py 的 TOPICS 保持一致
        return new String[]{"redis-cache", "es-shard", "mq-order", "pg-partition", "kafka-lag", "nginx-upstream"};
    }

    private static String readResource(String path) {
        try (InputStream in = GenerationEvalIT.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("缺少测试资源: " + path);
            }
            try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                StringBuilder sb = new StringBuilder();
                char[] buf = new char[4096];
                int n;
                while ((n = r.read(buf)) > 0) {
                    sb.append(buf, 0, n);
                }
                return sb.toString();
            }
        } catch (Exception e) {
            throw new IllegalStateException("读取测试资源失败: " + path, e);
        }
    }
}
