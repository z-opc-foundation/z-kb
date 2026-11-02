package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 生成侧评测 + 无检索基线对照，跑在两套语料上。
 *
 * <p><b>默认不跑</b>：需要一台可用的 OpenAI 兼容端点。设置 {@code EVAL_LLM_ENDPOINT}
 * 后才会执行 —— 否则常规构建会因为连不上评测机而红。
 *
 * <p>裁判模型必须是无 thinking 的（见 LlmJudge 类注释）；带思维链的模型会把推理写进
 * content，解析出的分数全是噪声。
 */
@EnabledIfEnvironmentVariable(named = "EVAL_LLM_ENDPOINT", matches = ".+")
class GenerationEvalIT {

    @Test
    @DisplayName("长尾私有事实上，检索应显著优于无检索基线")
    void longTailRetrievalBeatsBaseline() {
        String endpoint = System.getenv("EVAL_LLM_ENDPOINT");
        String model = System.getenv().getOrDefault("EVAL_MODEL", "qwen2.5:14b-instruct-q4_K_M");

        EvalSuite suite = EvalSuite.longTail();
        suite.load();

        GenerationEvalReport report = evaluate(suite, endpoint, model);
        GenerationEvalReport.Arm with = report.getArms().get(GenerationEvaluator.ARM_WITH_RETRIEVAL);
        GenerationEvalReport.Arm no = report.getArms().get(GenerationEvaluator.ARM_NO_RETRIEVAL);

        printReport(suite, report);
        assertArmsComparable(suite, with, no);

        // 上下文为空时「有检索臂更差」是装置假象，先钉死这个前提
        for (GenerationEvalReport.CaseScore s : with.cases) {
            assertFalse(s.contextChunkIds.isEmpty(), s.caseId + " 检索上下文为空");
        }

        // 无检索臂不可能知道「137 秒」这类私有口径，这里是真正的验收线
        assertTrue(with.getCorrectness() - no.getCorrectness() > 1.0,
                "长尾题上检索臂正确度未显著优于无检索臂: "
                        + no.getCorrectness() + " → " + with.getCorrectness());
    }

    @Test
    @DisplayName("公开常识语料上只记录两臂数值，不判成败（模型自身知识已足够）")
    void commonSenseRecordsBothArms() {
        String endpoint = System.getenv("EVAL_LLM_ENDPOINT");
        String model = System.getenv().getOrDefault("EVAL_MODEL", "qwen2.5:14b-instruct-q4_K_M");

        EvalSuite suite = EvalSuite.commonSense();
        suite.load();

        GenerationEvalReport report = evaluate(suite, endpoint, model);
        printReport(suite, report);
        GenerationEvalReport.Arm with = report.getArms().get(GenerationEvaluator.ARM_WITH_RETRIEVAL);
        GenerationEvalReport.Arm no = report.getArms().get(GenerationEvaluator.ARM_NO_RETRIEVAL);
        assertArmsComparable(suite, with, no);
        for (GenerationEvalReport.CaseScore s : with.cases) {
            assertFalse(s.contextChunkIds.isEmpty(), s.caseId + " 检索上下文为空");
        }
        // 无检索臂没有上下文，faithfulness 恒不适用，不能参与比较
        assertEquals(0.0, no.getFaithfulness(), 0.0);
    }

    private static GenerationEvalReport evaluate(EvalSuite suite, String endpoint, String model) {
        final HybridSearcher searcher = suite.searcher();
        SearchService service = new SearchService() {
            @Override
            public SearchResult search(SearchQuery query) {
                return searcher.search(query);
            }
        };
        LlmJudge llm = new LlmJudge(endpoint, model);
        return new GenerationEvaluator(service, llm, llm, SearchMode.FUSION, 5, 400)
                .evaluate(suite.dataset(), suite.workspace);
    }

    private static void printReport(EvalSuite suite, GenerationEvalReport report) {
        System.out.println("[gen:" + suite.name + "] " + GenerationEvaluator.headline(report));
        for (GenerationEvalReport.Arm arm : report.getArms().values()) {
            System.out.println(String.format("[gen:%s] %-15s n=%d correctness=%.2f relevancy=%.2f faithfulness=%.2f",
                    suite.name, arm.name, arm.getSampleSize(), arm.getCorrectness(),
                    arm.getAnswerRelevancy(), arm.getFaithfulness()));
        }
    }

    private static void assertArmsComparable(EvalSuite suite,
                                              GenerationEvalReport.Arm with,
                                              GenerationEvalReport.Arm no) {
        assertTrue(with.getSampleSize() > 0, suite.name + " 有检索臂无样本");
        assertEquals(with.getSampleSize(), no.getSampleSize(), suite.name + " 两臂样本数不等，对照无效");
    }
}
