package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.SearchMode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 检索策略消融对照 — 「证明检索增强到底增强了多少」的唯一硬证据。
 *
 * <p>只报一个 Recall 数字说明不了问题：可能是 BM25 在扛、向量在拖。把同一份标注集分别用
 * 单路与融合策略各跑一遍，差值才是各路贡献的可信度量。
 *
 * <p>使用前提：跑不同策略之间除 {@code mode} 外不得有任何变量变化（同一份语料、同一份
 * embedding 状态、同一个 topK）。TF-IDF 这类有状态 embedding 尤其要注意 ——
 * 评测期间发生 ingest 会让第二组结果不可比。
 */
public class AblationRunner {

    private final RetrievalEvaluator evaluator;

    public AblationRunner(RetrievalEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    /** 默认对照组：单向量 / 单 BM25 / 双路 / 三路 */
    public static List<SearchMode> standardArms() {
        return Arrays.asList(SearchMode.VECTOR, SearchMode.KEYWORD, SearchMode.HYBRID, SearchMode.FUSION);
    }

    public List<RetrievalEvalReport> run(EvalDataset dataset, List<SearchMode> arms,
                                          String workspace, int topK, int k) {
        List<RetrievalEvalReport> reports = new ArrayList<>();
        for (SearchMode mode : arms) {
            reports.add(evaluator.evaluate(dataset, mode, workspace, topK, k));
        }
        return reports;
    }

    /** 取融合策略相对最强单路的增益 —— 这是对外可引用的一句话结论 */
    public static String headline(List<RetrievalEvalReport> reports, SearchMode fusionMode, SearchMode bestBaseline) {
        RetrievalEvalReport fusion = find(reports, fusionMode);
        RetrievalEvalReport base = find(reports, bestBaseline);
        if (fusion == null || base == null) {
            return "对照臂缺失，无法给出增益结论";
        }
        RetrievalMetrics.Aggregate f = fusion.getOverall();
        RetrievalMetrics.Aggregate b = base.getOverall();
        if (f.sampleSize == 0 || b.sampleSize == 0) {
            return "样本量为 0，无法给出增益结论";
        }
        return String.format(
                "%s 相对 %s: HitRate@%d %.3f → %.3f (%+.3f), MRR %.3f → %.3f (%+.3f), n=%d",
                fusionMode, bestBaseline, fusion.getK(),
                b.hitRate, f.hitRate, f.hitRate - b.hitRate,
                b.mrr, f.mrr, f.mrr - b.mrr,
                f.sampleSize);
    }

    private static RetrievalEvalReport find(List<RetrievalEvalReport> reports, SearchMode mode) {
        for (RetrievalEvalReport r : reports) {
            if (r.getMode().equals(mode.name())) {
                return r;
            }
        }
        return null;
    }
}
