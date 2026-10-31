package com.zifang.z.***REMOVED***.resource.evaluation;

import com.zifang.z.***REMOVED***.api.evaluation.BadcaseCountInfo;
import com.zifang.z.***REMOVED***.api.evaluation.DatasetSummaryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseListInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalBadcaseUpdateParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalCaseResultPageInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalCaseResultPageParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetPublishParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetSaveParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalRunCreateParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalRunQueryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationDatasetInfo;
import com.zifang.z.***REMOVED***.api.evaluation.Evaluation***REMOVED***PageInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationOverviewInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationService;
import com.zifang.z.***REMOVED***.api.evaluation.RunSummaryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.TrustEvidenceInfo;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import java.util.List;

/**
 * 评测域默认实现：知识库评测概览、QA 数据集版本化管理、同步跑批、逐题结果与坏例台账。
 *
 * <p>z-***REMOVED*** 没有独立任务内核，跑批在请求内同步完成并返回终态；本地规则打分，不调用外部 Judge。</p>
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
    public Evaluation***REMOVED***PageInfo pageKnowledgeBase(int current, int size, String keyword,
            ***REMOVED***Caller caller) {
        return datasetManager.pageKnowledgeBase(current, size, keyword, caller);
    }

    @Override
    public EvaluationOverviewInfo queryOverview(String ***REMOVED***Id, String baselineRunId, ***REMOVED***Caller caller) {
        return datasetManager.queryOverview(***REMOVED***Id, baselineRunId, caller);
    }

    @Override
    public EvaluationDatasetInfo queryDataset(String ***REMOVED***Id, Integer versionNo, ***REMOVED***Caller caller) {
        return datasetManager.queryDataset(***REMOVED***Id, versionNo, caller);
    }

    @Override
    public DatasetSummaryInfo saveDatasetDraft(EvalDatasetSaveParam param, ***REMOVED***Caller caller) {
        return datasetManager.saveDatasetDraft(param, caller);
    }

    @Override
    public DatasetSummaryInfo publishDataset(EvalDatasetPublishParam param, ***REMOVED***Caller caller) {
        return datasetManager.publishDataset(param, caller);
    }

    @Override
    public RunSummaryInfo createRun(EvalRunCreateParam param, ***REMOVED***Caller caller) {
        return runExecutor.createRun(param, caller);
    }

    @Override
    public EvalRunQueryInfo queryRun(String runId, ***REMOVED***Caller caller) {
        return queryAssembler.queryRun(runId, caller);
    }

    @Override
    public EvalCaseResultPageInfo pageCaseResults(EvalCaseResultPageParam param, ***REMOVED***Caller caller) {
        return queryAssembler.pageCaseResults(param, caller);
    }

    @Override
    public EvalBadcaseListInfo listBadcases(String ***REMOVED***Id, String status, String stageCode,
            ***REMOVED***Caller caller) {
        return badcaseManager.listBadcases(***REMOVED***Id, status, stageCode, caller);
    }

    @Override
    public BadcaseCountInfo countBadcases(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        return badcaseManager.countBadcases(***REMOVED***Id, caller);
    }

    @Override
    public List<TrustEvidenceInfo> queryTrustEvidence(String runId, ***REMOVED***Caller caller) {
        return queryAssembler.queryTrustEvidence(runId, caller);
    }

    @Override
    public EvalBadcaseInfo updateBadcase(EvalBadcaseUpdateParam param, ***REMOVED***Caller caller) {
        return badcaseManager.updateBadcase(param, caller);
    }
}
