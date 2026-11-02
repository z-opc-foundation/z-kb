package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 在两套生成语料上跑检索侧消融。
 *
 * <ul>
 *   <li>eval2 — 公开技术常识（{@code _eval/gen_corpus.py} 生成）</li>
 *   <li>eval3 — 长尾私有事实（{@code _eval/gen_corpus_longtail.py} 生成），
 *       答案含具体阈值与编号，模型凭自身知识答不出来</li>
 * </ul>
 *
 * <p>两套都跑是为了看检索增益的可观测性差异：常识题上各臂都接近饱和，看不出
 * 策略差异；长尾题上才有区分度。
 */
class KbAblationOnGeneratedCorpusTest {

    @Test
    @DisplayName("两套语料上的四臂消融")
    void ablation() {
        for (EvalSuite suite : EvalSuite.all()) {
            suite.load();
            final HybridSearcher searcher = suite.searcher();
            SearchService service = new SearchService() {
                @Override
                public SearchResult search(SearchQuery query) {
                    return searcher.search(query);
                }
            };

            List<RetrievalEvalReport> reports = new AblationRunner(
                    new RetrievalEvaluator(service, suite.embedder().providerName()))
                    .run(suite.dataset(), AblationRunner.standardArms(), suite.workspace, 10, 5);

            for (RetrievalEvalReport r : reports) {
                RetrievalMetrics.Aggregate a = r.getOverall();
                System.out.println(String.format(
                        "[abl:%s] %-8s HitRate@%d=%.3f Recall=%.3f MRR=%.3f NDCG=%.3f n=%d empty=%d",
                        suite.name, r.getMode(), r.getK(), a.hitRate, a.recall, a.mrr, a.ndcg,
                        a.sampleSize, r.getEmptyResultCases()));
            }
            System.out.println("[abl:" + suite.name + "] "
                    + AblationRunner.headline(reports, SearchMode.FUSION, SearchMode.KEYWORD));

            for (RetrievalEvalReport r : reports) {
                assertTrue(r.getOverall().sampleSize > 0, suite.name + " " + r.getMode() + " 无样本");
                assertTrue(r.getOverall().sampleSize == reports.get(0).getOverall().sampleSize,
                        suite.name + " " + r.getMode() + " 样本量与其他臂不一致");
            }
            RetrievalEvalReport fusion = reports.get(3);
            assertTrue(fusion.getRouteHitCounts().getOrDefault("vector", 0) > 0,
                    suite.name + " FUSION 下向量路贡献为 0");
        }
    }
}
