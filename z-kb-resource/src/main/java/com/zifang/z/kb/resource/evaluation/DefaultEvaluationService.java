package com.zifang.z.kb.resource.evaluation;

import com.zifang.z.kb.api.evaluation.BadcaseCountInfo;
import com.zifang.z.kb.api.evaluation.DatasetSummaryInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseListInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseUpdateParam;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageInfo;
import com.zifang.z.kb.api.evaluation.EvalCaseResultPageParam;
import com.zifang.z.kb.api.evaluation.EvalDatasetPublishParam;
import com.zifang.z.kb.api.evaluation.EvalDatasetSaveParam;
import com.zifang.z.kb.api.evaluation.EvalRunCreateParam;
import com.zifang.z.kb.api.evaluation.EvalRunQueryInfo;
import com.zifang.z.kb.api.evaluation.EvaluationDatasetInfo;
import com.zifang.z.kb.api.evaluation.EvaluationKbPageInfo;
import com.zifang.z.kb.api.evaluation.EvaluationOverviewInfo;
import com.zifang.z.kb.api.evaluation.EvaluationService;
import com.zifang.z.kb.api.evaluation.RunSummaryInfo;
import com.zifang.z.kb.api.evaluation.TrustEvidenceInfo;
import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * 评测域默认实现：知识库评测概览、QA 数据集版本化管理、同步跑批、逐题结果与坏例台账。
 *
 * <p>z-kb 没有独立任务内核，跑批在请求内同步完成并返回终态；本地规则打分，不调用外部 Judge。</p>
 */
public class DefaultEvaluationService implements EvaluationService {

    private final EvaluationBadcaseManager badcaseManager;

    private final EvaluationDatasetManager datasetManager;

    private final EvaluationQueryAssembler queryAssembler;

    private final EvaluationRunExecutor runExecutor;

    public DefaultEvaluationService(EvaluationBadcaseManager badcaseManager,
            EvaluationDatasetManager datasetManager,
            EvaluationQueryAssembler queryAssembler,
            EvaluationRunExecutor runExecutor) {
        this.badcaseManager = badcaseManager;
        this.datasetManager = datasetManager;
        this.queryAssembler = queryAssembler;
        this.runExecutor = runExecutor;
    }

    @Override
    public EvaluationKbPageInfo pageKnowledgeBase(int current, int size, String keyword,
            KbCaller caller) {
        return datasetManager.pageKnowledgeBase(current, size, keyword, caller);
    }

    @Override
    public EvaluationOverviewInfo queryOverview(String kbId, String baselineRunId, KbCaller caller) {
        return datasetManager.queryOverview(kbId, baselineRunId, caller);
    }

    @Override
    public EvaluationDatasetInfo queryDataset(String kbId, Integer versionNo, KbCaller caller) {
        return datasetManager.queryDataset(kbId, versionNo, caller);
    }

    @Override
    public DatasetSummaryInfo saveDatasetDraft(EvalDatasetSaveParam param, KbCaller caller) {
        return datasetManager.saveDatasetDraft(param, caller);
    }

    @Override
    public DatasetSummaryInfo publishDataset(EvalDatasetPublishParam param, KbCaller caller) {
        return datasetManager.publishDataset(param, caller);
    }

    @Override
    public RunSummaryInfo createRun(EvalRunCreateParam param, KbCaller caller) {
        return runExecutor.createRun(param, caller);
    }

    @Override
    public EvalRunQueryInfo queryRun(String runId, KbCaller caller) {
        return queryAssembler.queryRun(runId, caller);
    }

    @Override
    public EvalCaseResultPageInfo pageCaseResults(EvalCaseResultPageParam param, KbCaller caller) {
        return queryAssembler.pageCaseResults(param, caller);
    }

    @Override
    public EvalBadcaseListInfo listBadcases(String kbId, String status, String stageCode,
            KbCaller caller) {
        return badcaseManager.listBadcases(kbId, status, stageCode, caller);
    }

    @Override
    public BadcaseCountInfo countBadcases(String kbId, KbCaller caller) {
        return badcaseManager.countBadcases(kbId, caller);
    }

    @Override
    public List<TrustEvidenceInfo> queryTrustEvidence(String runId, KbCaller caller) {
        return queryAssembler.queryTrustEvidence(runId, caller);
    }

    @Override
    public EvalBadcaseInfo updateBadcase(EvalBadcaseUpdateParam param, KbCaller caller) {
        return badcaseManager.updateBadcase(param, caller);
    }
}
