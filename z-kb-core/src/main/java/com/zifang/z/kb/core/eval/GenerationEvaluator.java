package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;

import java.util.ArrayList;
import java.util.List;

/**
 * 生成侧评测器 — 跑「有检索 / 无检索」两个臂，用同一份标准答案做对照。
 *
 * <p><b>为什么必须有 NO_RETRIEVAL 臂：</b>模型自身的世界知识足以让不少题目答得不错。
 * 只测有检索的一臂，拿到的高分分不清是检索的功劳还是模型本来就会 —— 这个差值才是
 * 「检索增强增强了多少」的唯一诚实度量。
 *
 * <p>指标分工：
 * <ul>
 *   <li>{@code correctness}（答案与标准答案的一致程度）—— 两臂都测，是对照的主指标</li>
 *   <li>{@code answerRelevancy}（是否切题）—— 两臂都测</li>
 *   <li>{@code faithfulness}（答案是否被检索上下文支持）—— 只对有检索臂有意义；
 *       无检索臂没有上下文，这一项恒无意义，强行比较只会得到一个必然巨大的假差值</li>
 * </ul>
 */
public class GenerationEvaluator {

    public static final String ARM_WITH_RETRIEVAL = "WITH_RETRIEVAL";
    public static final String ARM_NO_RETRIEVAL = "NO_RETRIEVAL";

    private static final String SYSTEM_RAG =
            "你是一个知识库问答助手。只依据提供的【参考资料】回答问题。"
                    + "参考资料中没有的内容，明确说明「提供的资料中没有提到」，不要编造。"
                    + "回答用中文，简明扼要。";

    private static final String SYSTEM_NO_RAG =
            "你是一个问答助手。用中文简明扼要地回答问题。";

    private final SearchService searchService;
    private final LlmJudge generator;
    private final LlmJudge judge;
    private final SearchMode mode;
    private final int topK;
    private final int maxTokens;

    public GenerationEvaluator(SearchService searchService, LlmJudge generator, LlmJudge judge,
                               SearchMode mode, int topK, int maxTokens) {
        this.searchService = searchService;
        this.generator = generator;
        this.judge = judge;
        this.mode = mode;
        this.topK = topK;
        this.maxTokens = maxTokens;
    }

    public GenerationEvalReport evaluate(EvalDataset dataset, String workspace) {
        GenerationEvalReport report = new GenerationEvalReport();
        report.setDatasetVersion(dataset.getDatasetVersion());
        report.setKnowledgeVersion(dataset.getKnowledgeVersion());

        GenerationEvalReport.Arm withRag = new GenerationEvalReport.Arm(ARM_WITH_RETRIEVAL);
        GenerationEvalReport.Arm noRag = new GenerationEvalReport.Arm(ARM_NO_RETRIEVAL);
        report.getArms().put(ARM_WITH_RETRIEVAL, withRag);
        report.getArms().put(ARM_NO_RETRIEVAL, noRag);

        for (EvalCase c : dataset.getCases()) {
            if (!c.isScoredForRetrieval()) {
                continue;   // 不可答用例走单独的拒答评测，不混进正确率
            }

            SearchQuery q = new SearchQuery();
            q.setQuery(c.getQuestion());
            q.setWorkspace(workspace);
            q.setMode(mode);
            q.setTopK(topK);
            SearchResult sr = searchService.search(q);

            List<String> contextIds = new ArrayList<>();
            StringBuilder ctx = new StringBuilder();
            if (sr != null && sr.getHits() != null) {
                for (SearchHit h : sr.getHits()) {
                    if (h.getContent() == null || h.getContent().isEmpty()) {
                        continue;
                    }
                    contextIds.add(h.getChunkId());
                    ctx.append("- ").append(h.getContent()).append('\n');
                }
            }

            String ragAnswer = generator.generate(SYSTEM_RAG,
                    "【参考资料】\n" + ctx + "\n【问题】\n" + c.getQuestion(), maxTokens);
            String noRagAnswer = generator.generate(SYSTEM_NO_RAG, c.getQuestion(), maxTokens);

            int ragCorrect = judgeCorrectness(c, ragAnswer);
            int noRagCorrect = judgeCorrectness(c, noRagAnswer);
            int ragRelevant = judgeRelevancy(c.getQuestion(), ragAnswer);
            int noRagRelevant = judgeRelevancy(c.getQuestion(), noRagAnswer);
            int faithful = judgeFaithfulness(ctx.toString(), ragAnswer);

            withRag.cases.add(new GenerationEvalReport.CaseScore(
                    c.getCaseId(), c.getQuestion(), ragAnswer, ragCorrect, faithful, ragRelevant, contextIds));
            noRag.cases.add(new GenerationEvalReport.CaseScore(
                    c.getCaseId(), c.getQuestion(), noRagAnswer, noRagCorrect, -1, noRagRelevant,
                    new ArrayList<String>()));
        }

        fillAggregates(withRag);
        fillAggregates(noRag);
        return report;
    }

    /** 两臂可比的主指标：答案与标准答案的一致程度 */
    private int judgeCorrectness(EvalCase c, String answer) {
        return judge.score(
                "你是严格的评分员。比较【模型答案】与【标准答案】，判断模型答案在实质内容上是否与标准答案一致。"
                        + "只答对一部分要按比例给分；答错、遗漏关键点、或编造内容都要扣分。",
                "【问题】\n" + c.getQuestion()
                        + "\n【模型答案】\n" + answer
                        + "\n【标准答案】\n" + c.getGroundTruth(),
                10);
    }

    private int judgeRelevancy(String question, String answer) {
        return judge.score(
                "你是严格的评分员。判断【回答】是否真正针对【问题】作答，有没有跑题或答非所问。",
                "【问题】\n" + question + "\n【回答】\n" + answer,
                10);
    }

    private int judgeFaithfulness(String context, String answer) {
        return judge.score(
                "你是严格的评分员。判断【回答】中的每一句事实性陈述，是否都能在【参考资料】中找到依据。"
                        + "凡是没有依据的内容（编造、臆测、引入资料外知识）都要扣分。",
                "【参考资料】\n" + context + "\n【回答】\n" + answer,
                10);
    }

    private void fillAggregates(GenerationEvalReport.Arm arm) {
        if (arm.cases.isEmpty()) {
            return;
        }
        double correct = 0, relevant = 0, faithful = 0;
        int faithfulCount = 0;
        for (GenerationEvalReport.CaseScore s : arm.cases) {
            correct += s.correctness;
            relevant += s.answerRelevancy;
            if (s.faithfulness >= 0) {
                faithful += s.faithfulness;
                faithfulCount++;
            }
        }
        int n = arm.cases.size();
        arm.setCorrectness(correct / n);
        arm.setAnswerRelevancy(relevant / n);
        // 无检索臂没有上下文，faithfulness 不适用，保持 0 且不参与任何对比
        arm.setFaithfulness(faithfulCount == 0 ? 0 : faithful / faithfulCount);
        arm.setSampleSize(n);
    }

    /** 检索带来的净增益 —— 这是对外唯一可引用的一句话结论 */
    public static String headline(GenerationEvalReport report) {
        GenerationEvalReport.Arm with = report.getArms().get(ARM_WITH_RETRIEVAL);
        GenerationEvalReport.Arm no = report.getArms().get(ARM_NO_RETRIEVAL);
        if (with == null || no == null || with.getSampleSize() == 0 || no.getSampleSize() == 0) {
            return "样本不足，无法给出增益结论";
        }
        return String.format(
                "检索带来的净增益（n=%d）: 正确度 %.2f → %.2f (%+.2f), 切题度 %.2f → %.2f (%+.2f), "
                        + "有检索臂忠实度 %.2f",
                with.getSampleSize(),
                no.getCorrectness(), with.getCorrectness(),
                with.getCorrectness() - no.getCorrectness(),
                no.getAnswerRelevancy(), with.getAnswerRelevancy(),
                with.getAnswerRelevancy() - no.getAnswerRelevancy(),
                with.getFaithfulness());
    }
}
